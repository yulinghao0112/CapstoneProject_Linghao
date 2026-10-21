import React, { useState } from 'react';
import {
  Modal, ModalHeader, ModalBody, ModalFooter,
  Button, Input, FormGroup, Label
} from 'reactstrap';
import AlertModal from './AlertModal';

const CreateMeetingModal = ({ isOpen, toggle, onCreate }) => {
  const [meetingTitle, setMeetingTitle] = useState('');
  const BASE_URL = "http://localhost:5002/api";
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');
  const [onModalConfirm, setOnModalConfirm] = useState(() => () => {});
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!meetingTitle.trim()) {
      setModalTitle("Missing Title");
      setModalMessage("Please enter the name of the meeting");
      setOnModalConfirm(() => () => {});
      setModalOpen(true);
      return;
    }
    setLoading(true);
    try {
      const authUser1 = JSON.parse(localStorage.getItem("authUser"));
      const userId1 = authUser1?.user_id;

      const idRes = await fetch(`${BASE_URL}/meetings/next-id?user_id=${userId1}`, {
        method: "GET"
      });

      if (!idRes.ok) throw new Error("Unable to get next meeting ID");
      const { next_meeting_id } = await idRes.json();

      const createRes = await fetch(`${BASE_URL}/meetings/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          user_id: userId1,
          meeting_id: next_meeting_id,
          title: meetingTitle.trim(),
        }),
      });

      if (!createRes.ok) {
        const errText = await createRes.text();
        throw new Error(errText || "Failed to create meeting");
      }

      const authUser = JSON.parse(localStorage.getItem("authUser"));

      const userId = authUser.user_id;

      const projectsRes = await fetch(`${BASE_URL}/jira-oauth/my-projects`, {
        method: "GET",
        headers: {
          "Authorization": "Bearer " + localStorage.getItem("access_token")
        }
      });
      
      const projectsJson = await projectsRes.json();
      
      if (!projectsJson.projects || projectsJson.projects.length === 0) {
        throw new Error("No Jira projects available for this user.");
      }
      
      // Get the first (or main project) project_key
      const projectKey = projectsJson.projects[0].key;
      console.log(projectsJson)
      console.log('wewe')

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
          meeting_id: next_meeting_id
        })
      });
  
      if (!aiSummaryRes.ok) {
        const errText = await aiSummaryRes.text();
        throw new Error(`AI summary failed: ${errText}`);
      }

      setModalTitle("Success");
      setModalMessage("✅ Create a meeting and synchronize JIRA successfully!");
      setOnModalConfirm(() => () => {
        onCreate(next_meeting_id);
        setMeetingTitle("");
        toggle();
      });
      setModalOpen(true);
    } catch (err) {
      setModalTitle("Error");
      setModalMessage(`Failed to create a meeting: ${err.message}`);
      setOnModalConfirm(() => () => {});
      setModalOpen(true);
    }finally{
      setLoading(false);
    }
  };

  return (
    <>
      <AlertModal
        isOpen={modalOpen}
        toggle={() => setModalOpen(!modalOpen)}
        title={modalTitle}
        message={modalMessage}
        onConfirm={() => {
          onModalConfirm();
          setOnModalConfirm(() => () => {});
          setModalOpen(false);
        }}
      />

      <Modal isOpen={isOpen} toggle={toggle}>
        <ModalHeader toggle={toggle}>Create new meeting</ModalHeader>
        <ModalBody>
          <FormGroup>
            <Label for="meetingTitle">Meeting Title</Label>
            <Input
              id="meetingTitle"
              placeholder="Please enter meeting title"
              value={meetingTitle}
              onChange={(e) => setMeetingTitle(e.target.value)}
            />
          </FormGroup>
        </ModalBody>
        <ModalFooter>
        <Button color="primary" onClick={handleSubmit} disabled={loading}>
          {loading ? (
            <>
              <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
              Creating...
            </>
          ) : (
            "Create"
          )}
        </Button>
          <Button color="secondary" onClick={toggle}>Cancel</Button>
        </ModalFooter>
      </Modal>
    </>
  );
};

export default CreateMeetingModal;
