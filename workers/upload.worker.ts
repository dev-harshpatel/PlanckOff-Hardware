import { processDoorScheduleFile, processHardwareSetFile } from '../services/fileUploadService';

const controllers = new Map<string, AbortController>();

self.onmessage = async (e: MessageEvent) => {
    const { action, taskId, type, file, apiKey, settings } = e.data;

    // Handle Control Actions
    if (action === 'STOP') {
        const controller = controllers.get(taskId);
        if (controller) controller.abort('stop');
        return;
    }
    
    if (action === 'CANCEL') {
        const controller = controllers.get(taskId);
        if (controller) controller.abort('cancel');
        return;
    }

    // Default: START
    if (!file) {
      self.postMessage({ type: 'error', taskId, error: 'No file received in worker' });
      return;
    }

    const controller = new AbortController();
    controllers.set(taskId, controller);

    try {
        const onProgress = (stage: string, percent: number) => {
            self.postMessage({ type: 'progress', taskId, stage, percent });
        };
        
        const onData = (data: any[]) => {
            self.postMessage({ type: 'partial_data', taskId, data });
        };

        let result;
        if (type === 'door-schedule') {
             result = await processDoorScheduleFile(file, apiKey, onProgress, onData, controller.signal, settings);
        } else if (type === 'hardware-set') {
             result = await processHardwareSetFile(file, apiKey, onProgress, onData, controller.signal, settings);
        } else {
             throw new Error("Unknown upload type: " + type);
        }

        self.postMessage({ type: 'complete', taskId, result });
    } catch (error: any) {
        // Distinguish between Abort (Stop/Cancel) and Error
        if (controller.signal.aborted) {
            const reason = controller.signal.reason;
            // If stopped gracefully, we might want to consider it 'complete' with partial data?
            // But usually the service returns the result if stopped gracefully (break loop).
            // So if we are here in catch, it might be 'cancel' (throw).
             if (reason === 'cancel') {
                  self.postMessage({ type: 'cancelled', taskId });
                  return;
             }
        }
        
        console.error("Worker Error:", error);
        self.postMessage({ type: 'error', taskId, error: error.message || String(error) });
    } finally {
        controllers.delete(taskId);
    }
};

export {};
