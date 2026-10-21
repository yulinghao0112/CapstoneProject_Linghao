/**
 * Project state initializer component
 * Fetches current project information on app startup and updates Redux state
 */
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setCurrentProject } from '../redux/actions';

const ProjectInitializer = () => {
  const dispatch = useDispatch();
  const currentProject = useSelector(state => state.Chat.currentProject);

  useEffect(() => {
    const initializeProjectState = async () => {
      // Skip if Redux already has project information
      if (currentProject?.key) {
        return;
      }

      try {
        const token = localStorage.getItem("access_token");
        if (!token) return;

        const response = await fetch("http://localhost:5002/api/jira-oauth/my-projects", {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          }
        });

        if (response.ok) {
          const data = await response.json();
          if (data.projects && data.projects.length > 0) {
            const currentProject = data.projects[0];
            const projectInfo = {
              key: currentProject.key,
              name: currentProject.name,
              id: currentProject.id || currentProject.key
            };
            dispatch(setCurrentProject(projectInfo));
          }
        }
      } catch (error) {
        console.error("Failed to initialize project state:", error);
      }
    };

    initializeProjectState();
  }, [dispatch, currentProject?.key]);

  // This component renders nothing, only handles state initialization
  return null;
};

export default ProjectInitializer;