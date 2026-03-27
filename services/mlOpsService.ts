import { Door, TrainingExample, MLModelMetrics } from '../types';

const STORAGE_KEY_DATASET = 'tve_training_dataset';
const STORAGE_KEY_METRICS = 'tve_ml_metrics';

/**
 * Sanitizes text to remove PII (Emails, Phone Numbers) before storage.
 * Ensures GDPR/Privacy compliance for training data.
 */
const sanitizeText = (text: string): string => {
    if (!text) return '';
    // Regex for emails
    let clean = text.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL_REDACTED]');
    // Regex for phone numbers (simple US format)
    clean = clean.replace(/(\+\d{1,2}\s)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g, '[PHONE_REDACTED]');
    return clean;
};

/**
 * Captures a finalized door assignment as a training example.
 * Aggregates data to retrain/inform the model ("Continuous Learning").
 * @param door The door object with final data.
 * @param originalAiPrediction The Set Name the AI originally guessed (optional context).
 */
export const captureTrainingExample = (door: Door, originalAiPrediction: string | null) => {
    if (!door.assignedHardwareSet) return;

    // Create a clean training example
    const example: TrainingExample = {
        id: `train-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        timestamp: new Date().toISOString(),
        inputContext: {
            doorType: sanitizeText(door.type),
            fireRating: sanitizeText(door.fireRating),
            location: sanitizeText(door.location),
            hardwarePrep: sanitizeText(door.hardwarePrep),
            material: `${door.doorMaterial} / ${door.frameMaterial}`
        },
        userCorrection: door.assignedHardwareSet.name, // The Ground Truth
    };

    // 1. Load Existing Dataset (Simulated Data Lake)
    const currentDatasetString = localStorage.getItem(STORAGE_KEY_DATASET);
    const currentDataset: TrainingExample[] = currentDatasetString ? JSON.parse(currentDatasetString) : [];
    
    // 2. Add new example (Deduplicate based on content signature if needed, simple push for now)
    // We keep a rolling window of the last 200 examples to keep localStorage light
    const updatedDataset = [example, ...currentDataset].slice(0, 200); 
    
    localStorage.setItem(STORAGE_KEY_DATASET, JSON.stringify(updatedDataset));

    // 3. Update Metrics
    updateMetrics(updatedDataset.length);
};

const updateMetrics = (datasetSize: number) => {
    const metrics: MLModelMetrics = {
        totalExamples: datasetSize,
        lastLearned: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY_METRICS, JSON.stringify(metrics));
};

/**
 * Retrieves high-quality examples from the training dataset to inject into the AI Prompt.
 * This implements the "Continuous Learning" loop via RAG (Retrieval Augmented Generation).
 */
export const getLearnedExamples = (): string => {
    const datasetString = localStorage.getItem(STORAGE_KEY_DATASET);
    if (!datasetString) return '';

    const dataset: TrainingExample[] = JSON.parse(datasetString);
    
    // Filter for valid examples where we have meaningful context
    // We use a Map to get unique rules (latest wins)
    const uniqueRules = new Map<string, string>();
    
    dataset.forEach(ex => {
        // Create a signature key
        const key = `${ex.inputContext.fireRating}-${ex.inputContext.doorType}-${ex.inputContext.hardwarePrep}`;
        // Create a human-readable rule
        const rule = `- Condition: Fire Rating "${ex.inputContext.fireRating}", Type "${ex.inputContext.doorType}", Prep "${ex.inputContext.hardwarePrep}" -> Assign Set: "${ex.userCorrection}"`;
        
        if (!uniqueRules.has(key)) {
            uniqueRules.set(key, rule);
        }
    });

    // Take the top 5 most relevant/recent rules to inject
    const examples = Array.from(uniqueRules.values()).slice(0, 5).join('\n');

    if (examples.length > 0) {
        return `\n**LEARNED PATTERNS FROM PREVIOUS PROJECTS (Prioritize these rules):**\n${examples}\n`;
    }
    return '';
};
