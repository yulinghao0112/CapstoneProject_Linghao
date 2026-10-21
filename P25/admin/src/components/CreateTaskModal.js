import React, { useState } from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter, Button, Input, FormGroup, Label } from 'reactstrap';
import { useSelector } from 'react-redux';

const CreateTaskModal = ({ isOpen, toggle, }) => {
  const [task, setTask] = useState({
    assignee: "",
    deadline: "",
    description: "",
    internal_priority: "",
    jira_priority: "",
    task_id: ""
  });

  const handleChange = (field, value) => {
    setTask(prev => ({ ...prev, [field]: value }));
  };

  const activeMeetingId = useSelector( state => state.Chat.activeMeetingId);

  const handleSubmit = async() => {
    console.log("当前 activeMeetingId:", activeMeetingId);
    if (!task.assignee || !task.deadline) {
      alert("Please fill in the required information!");
      return;
    }

    const authUser = JSON.parse(localStorage.getItem("authUser"));

    // if (authUser) {
    const userId = authUser.user_id;
    console.log("✅ user_id:", userId);
        
    toggle();
     const BASE_URL = "http://localhost:5002/api";
        try {
        const res = await fetch(`${BASE_URL}/meetings/${activeMeetingId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            // user_id: userId,
            assignee: task.assignee,
            deadline: task.deadline,
            description: task.description,
            internal_priority: task.internal_priority,
            jira_priority: task.jira_priority,
            task_id: task.task_id
        })
        });

        if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "Failed to create task");
        }

        alert("✅ Creation of the task was successful!");
        toggle();
    } catch (err) {
        console.error("❌ Error creating task", err);
        alert(`Error creating task.:${err.message}`);
    }

  };

  return (
    <Modal isOpen={isOpen} toggle={toggle}>
      <ModalHeader toggle={toggle}>Create new task</ModalHeader>
      <ModalBody>

      </ModalBody>
      <ModalFooter>
        <Button color="primary" onClick={handleSubmit}>Create</Button>
        <Button color="secondary" onClick={toggle}>Cancel</Button>
      </ModalFooter>
    </Modal>
  );
};

export default CreateTaskModal;
