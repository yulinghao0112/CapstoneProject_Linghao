import React, { useState, useEffect } from 'react';
import { Collapse, Button, CardBody,Card,CardHeader, Spinner } from 'reactstrap';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { setActiveMeetingId } from "./../redux/actions";
import { connect } from 'react-redux';
import { useSelector } from 'react-redux';



const JiraSummary = ({ initialSummaryText }) => {
  const [isOpen, setIsOpen] = useState(true);
  const [summaryText, setSummaryText] = useState(initialSummaryText);
  const [loading, setLoading] = useState(false); 
  const activeMeetingId = useSelector(state => state.Chat.activeMeetingId)
  const currentProject = useSelector(state => state.Chat.currentProject)
  
  useEffect(() => {
    // Clear old data when project changes
    if (currentProject?.key) {
      setSummaryText("");
    }
    
    setSummaryText(initialSummaryText);
    
    // Fetch AI summary when meeting ID or project changes
    if (activeMeetingId) {
      fetchExistingSummary();
    }
  }, [initialSummaryText, activeMeetingId, currentProject?.key]);

  // Fetch AI summary for current project only
  const fetchExistingSummary = async () => {
    if (!activeMeetingId || !currentProject?.key) {
      setSummaryText("");
      return;
    }
    
    try {
      const response = await fetch("http://localhost:5002/api/jira-oauth/ai-summary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("access_token")}`
        },
        body: JSON.stringify({
          meeting_id: activeMeetingId,
          project_key: currentProject.key
        })
      });

      if (!response.ok) {
        setSummaryText("");
        return;
      }

      const data = await response.json();
      setSummaryText(data.summary || "");
      
    } catch (error) {
      console.error("Failed to fetch project summary:", error);
      setSummaryText("");
    }
  };

  const toggle = () => setIsOpen(!isOpen);

  const priorityColor = {
    High: 'success',
    Medium: 'warning',
    Low: 'primary'
  };

  const fetchSummary = async () => {
    setLoading(true);
    const BASE_URL = "http://localhost:5002/api";
    
    if (!activeMeetingId) {
      setSummaryText('❌ No active meeting selected. Please select a meeting first.');
      setLoading(false);
      return;
    }
    
    try {
        const projectsRes = await fetch(`${BASE_URL}/jira-oauth/my-projects`, {
          method: "GET",
          headers: {
            "Authorization": "Bearer " + localStorage.getItem("access_token")
          }
        });
        
        if (!projectsRes.ok) {
          throw new Error(`Failed to fetch projects: ${projectsRes.status}`);
        }
        
        const projectsJson = await projectsRes.json();
        
        if (!projectsJson.projects || projectsJson.projects.length === 0) {
          throw new Error("No Jira projects available. Please connect to Jira first.");
        }
      
      // Get first project_key
      const projectKey = projectsJson.projects[0].key;
      const syncFromJiraRes = await fetch(`${BASE_URL}/jira-oauth/sync-from-jira`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + localStorage.getItem("access_token")
        },
        body: JSON.stringify({
          project_key: projectKey
        })
      });
      if (!syncFromJiraRes.ok) {
        const errText = await syncFromJiraRes.text();
        throw new Error(`Sync from Jira failed: ${errText}`);
      }

      const aiSummaryRes = await fetch(`${BASE_URL}/jira-oauth/ai-summary`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + localStorage.getItem("access_token")
        },
        body: JSON.stringify({
          meeting_id: activeMeetingId
        })
      });
  
      if (!aiSummaryRes.ok) {
        const errText = await aiSummaryRes.text();
        throw new Error(`AI summary failed: ${errText}`);
      }
  
      const summaryJson = await aiSummaryRes.json();
      setSummaryText(summaryJson.summary);

    } catch(err) {
      console.error('Fail to fetch summary:', err);
      setSummaryText(`❌ Failed to load summary: ${err.message}`);  
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="mb-3 shadow-sm sticky-summary">
      <CardHeader onClick={toggle} style={{ cursor: 'pointer' }} className="d-flex justify-content-between align-items-center">
        <div className="fw-bold d-flex align-items-center gap-2 jira-summary">
          <i className="ri-task-line text-primary fs-5"></i>
          Summary of JIRA
        </div>
        <div className='d-flex align-item-center gap-2 ms-auto'>
          <Button color="primary" size='sm' onClick={(e) => {
            e.stopPropagation();
            fetchSummary();
          }} disabled={loading}>
            {loading ? <Spinner size='sm'/> : 'Update Jira'}
          </Button>
        </div>
        <i className={`ri-arrow-${isOpen ? 'up' : 'down'}-s-line text-muted fs-5`} onClick={toggle} style={{ cursor: 'pointer' }}></i>
      </CardHeader>

      <Collapse isOpen={isOpen}>
        <CardBody className="pt-3 pb-2">
          <div key={currentProject?.key}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{summaryText}</ReactMarkdown>
          </div>
        </CardBody>
      </Collapse>
    </Card>
  );
};

const mapStateToProps = (state) => {
  const { activeMeetingId } = state.Chat;
  return { activeMeetingId };
};

export default connect(mapStateToProps, { setActiveMeetingId })(JiraSummary);