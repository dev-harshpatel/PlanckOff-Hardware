import React from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useProject } from '../contexts/ProjectContext';
import ReportsView from './ReportsView';

const ReportsViewWrapper: React.FC = () => {
    const { id } = useParams();
    const { projects } = useProject();

    const activeProject = projects.find(p => p.id === id);

    if (!activeProject) {
        return <Navigate to="/" replace />;
    }

    return (
        <ReportsView
            doors={activeProject.doors}
            hardwareSets={activeProject.hardwareSets}
            elevationTypes={activeProject.elevationTypes || []}
            projectName={activeProject.name}
        />
    );
};

export default ReportsViewWrapper;
