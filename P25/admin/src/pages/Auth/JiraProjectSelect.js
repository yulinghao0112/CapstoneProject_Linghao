import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { setCurrentProject } from '../../redux/actions';

const JiraProjectSelect = () => {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const dispatch = useDispatch();

  useEffect(() => {
    const fetchProjects = async () => {
      const token = localStorage.getItem("access_token");
      
      try {
        const res = await fetch('http://localhost:5002/api/jira-oauth/available-projects',{
            method: "GET",
                headers: {
                "Authorization": `Bearer ${token}`
            },
        });
        if (!res.ok) throw new Error();
        const data = await res.json();
        console.log(data);
        setProjects(data.projects);
      } catch {
        setError('Unable to fetch JIra project list');
      }
    };

    fetchProjects();
  }, []);

  const handleSubmit = async () => {
    if (!selectedProject) {
      setError('You must select one project!');
      return;
    }
    const selectedProjectObj = projects.find(p => p.key === selectedProject);
        if (!selectedProjectObj) {
            setError('The project you selected is invalid');
            return;
        }
    
    const token = localStorage.getItem("access_token");
    try {
      const res = await fetch('http://localhost:5002/api/jira-oauth/project-preferences', {
        method: 'POST',
        headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
                primary_project: selectedProjectObj.key,
                selected_projects: [{
                  key: selectedProjectObj.key,
                  name: selectedProjectObj.name
                }]
              }),
      });

      if (res.ok) {
        try {
            const syncRes = await fetch('http://localhost:5002/api/jira-oauth/sync-from-jira', {
              method: 'POST',
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
              },
              body: JSON.stringify({
                max_results: 100,
                project_key: selectedProjectObj.key
              })
            });
        
            if (!syncRes.ok) {
              setError('Successfully submit project selection, but fail to sync tasks');
              return;
            }
            const result = await syncRes.json();
                
          } catch (err) {
            setError('The project was successfully submitted, but an error occurred during synchronization.');
            return;
          }
        
        // Update Redux state with selected project
        const projectInfo = {
          key: selectedProjectObj.key,
          name: selectedProjectObj.name,
          id: selectedProjectObj.id
        };
        
        dispatch(setCurrentProject(projectInfo));
        
        navigate('/dashboard');
      } else {
        setError('Submission failed. Please check your login status or try again later.');
      }
    } catch {
      setError('Network error, unable to submit.');
    }
  };

  return (
    <div className="container mt-5">
      <div className="card shadow p-4">
        <h4 className="mb-4">Please Select One Jira Project</h4>

        <div className="mb-3">
          <select
            className="form-select"
            value={selectedProject}
            onChange={e => setSelectedProject(e.target.value)}
          >
            <option value="">-- Please select one project --</option>
            {projects.map((project, index) => (
              <option key={project.key || project.id || `project-${index}`} value={project.key}>
                {project.name}
              </option>
            ))}
          </select>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}

        <button className="btn btn-primary w-100" onClick={handleSubmit}>
          Submit
        </button>
      </div>
    </div>
  );
};

export default JiraProjectSelect;
