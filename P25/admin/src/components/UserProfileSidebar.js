import React, { useState, useEffect } from 'react';
import { connect } from "react-redux";
import { Button, Card, Badge } from "reactstrap";
import { useSelector } from 'react-redux';
import { Modal, ModalHeader, ModalBody } from "reactstrap";

//Simple bar
import SimpleBar from "simplebar-react";

//components
import AttachedFiles from "./AttachedFiles";
import CustomCollapse from "./CustomCollapse";

//actions
import { closeUserSidebar } from "../redux/actions";

//i18n
import { useTranslation } from 'react-i18next';

//image
import avatar7 from "../assets/images/users/avatar-7.jpg";

import CreateTaskModal from './CreateTaskModal';

function findNearestEpicAndStories(task, allTasks) {
    let current = task;
    const stories = [];
    let epic = null;

    // Step 1: Traverse up the parent_chain, collect stories, and potentially find Epic
    while (current && current.parent_issue_key) {
        const parent = allTasks.find(t => t.jira_issue_key === current.parent_issue_key);
        if (!parent) break;

        if (parent.jira_issue_type === "Story") {
            stories.unshift(parent); // Ensure order from Epic → Story → Subtask
        } else if (parent.jira_issue_type === "Epic") {
            epic = parent;
            break; // Stop once Epic is found
        }

        current = parent;
    }

    // Step 2: If Epic not found in parent chain, search by epic_issue_key
    if (!epic && task.epic_issue_key) {
        const epicCandidate = allTasks.find(t => t.jira_issue_key === task.epic_issue_key);
        if (epicCandidate && epicCandidate.jira_issue_type === "Epic") {
            epic = epicCandidate;
        }
    }

    return { epic, stories };
}



function UserProfileSidebar(props) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isOpen1, setIsOpen1] = useState(true);
    const [isOpen2, setIsOpen2] = useState(false);
    const [isOpen3, setIsOpen3] = useState(false);
    const [files, setFiles] = useState([
        { name: "", size: "", thumbnail: "" },
    ]);

    /* intilize t variable for multi language implementation */
    const { t } = useTranslation();

    const activeMeetingId = useSelector( state => state.Chat.activeMeetingId);
    const currentProject = useSelector( state => state.Chat.currentProject);

    const BASE = "http://localhost:5002/api/jira";
    const [tasks, setTasks] = useState([]);
    const [loadingTasks, setLoadingTasks] = useState(false);
    const [taskError, setTaskError] = useState("");

    const [descModalOpen, setDescModalOpen] = useState(false);
    const [descContent, setDescContent] = useState("");
    const allTasks = tasks;


    useEffect(() => {
        async function loadTasks() {
            // Clear old tasks when project changes
            if (currentProject?.key) {
                setTasks([]);
                setTaskError("");
            }
            
            if (!activeMeetingId) {
                return;
            }
            
            setLoadingTasks(true);

            const authUser = JSON.parse(localStorage.getItem("authUser"));
            const userId = authUser.user_id;
            
            try {
               const res = await fetch("http://localhost:5002/api/jira-oauth/jira-tasks", {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${localStorage.getItem("access_token")}`
                }
                });
                if (!res.ok) throw new Error("Failed to fetch tasks");
                const data = await res.json();

                setTasks(data.tasks);
                setTaskError("");
            } catch (err) {
                setTaskError("Failed to load tasks");
            } finally {
                setLoadingTasks(false);
            }
        }

        loadTasks();
    }, [activeMeetingId, currentProject?.key]);

    const toggleCollapse1 = () => {
        setIsOpen1(!isOpen1);
        setIsOpen2(false);
        setIsOpen3(false);
    };

    const toggleCollapse2 = () => {
        const newOpen = !isOpen2;
        setIsOpen2(newOpen);
        setIsOpen1(false);
        setIsOpen3(false);

        if (newOpen) {
            // Only fetch when expanding
            // Fetch all material information from backend
            fetchAttachedFiles();
        }
    };

    const toggleCollapse3 = () => {
        setIsOpen3(!isOpen3);
        setIsOpen1(false);
        setIsOpen2(false);
    };

    // closes sidebar
    const closeuserSidebar = () => {
        props.closeUserSidebar();
    }

    // Meeting modal
    const toggleModal = () => {
        setIsModalOpen(prev => !prev);
    };



        const fetchAttachedFiles = async () => {
            const userId = JSON.parse(localStorage.getItem("authUser"))?.user_id;
            const BASE_URL = "http://localhost:5002/api";

            try {
                const res = await fetch(`${BASE_URL}/meetings/${activeMeetingId}/materials/download?user_id=${userId}`);
                const rawText = await res.text();

                if (!res.ok) {
                    throw new Error(`Failed to fetch materials: ${rawText}`);
                }

                // Split multiple === filename === sections
                const fileSections = rawText.split(/^===\s*(.+?)\s*===\s*$/gm);
                // split returns [empty, filename1, content1, filename2, content2, ...]
                
                const files = [];
                for (let i = 1; i < fileSections.length; i += 2) {
                    const name = fileSections[i].trim();
                    const content = fileSections[i + 1]?.trim() ?? "";
                    files.push({ name, content });
                }

                setFiles(files);
            } catch (err) {
            }
        };





    // style={{display: props.userSidebar  ? "block" : "none"}}
    return (
        <React.Fragment>
            <div style={{ display: (props.userSidebar === true) ? "block" : "none" }} className="user-profile-sidebar">
                <div className="px-3 px-lg-4 pt-3 pt-lg-4">
                    <div className="user-chat-nav  text-end">
                        <Button color="none" type="button" onClick={closeuserSidebar} className="nav-btn" id="user-profile-hide">
                            <i className="ri-close-line"></i>
                        </Button>
                    </div>
                </div>

                <div className="text-center p-4 border-bottom">

                    <div className="mb-4 d-flex justify-content-center">
                        {
                            props.activeUser.profilePicture === "Null" ?
                                <div className="avatar-lg">
                                    <span className="avatar-title rounded-circle bg-primary-subtle text-primary font-size-24">
                                        {props.activeUser.name.charAt(0)}
                                    </span>
                                </div>
                                : <img src={props.activeUser.profilePicture} className="rounded-circle avatar-lg img-thumbnail" alt="chatvia" />
                        }

                    </div>

                    <h5 className="font-size-16 mb-1 text-truncate">Reminder</h5>
                    <p className="text-muted text-truncate mb-1"></p>
                </div>
                {/* End profile user */}

                {/* Start user-profile-desc */}
                <SimpleBar style={{ maxHeight: "58%" }} className="p-4 user-profile-desc">

                    <div id="profile-user-accordion" className="custom-accordion">
                        <Card className="shadow-none border mb-2">
                        
                            {/* import collaps */}
                            <CustomCollapse
                                title="Tasks"
                                iconClass="ri-task-line"
                                isOpen={isOpen1}
                                toggleCollapse={toggleCollapse1}
                            >
                                {loadingTasks && <p>Loading tasks...</p>}
                                {taskError && <p style={{color: "red"}}>{taskError}</p>}
                                {tasks.length === 0 && !loadingTasks && <p>No tasks found.</p>}
                                {tasks
                                      .filter(t =>
                                            t.jira_issue_type === "Subtask" &&
                                            t.status?.toLowerCase() === "to do"
                                        )
                                        .sort((a, b) => {
                                            const priA = a.internal_priority ?? -Infinity;
                                            const priB = b.internal_priority ?? -Infinity;
                                            return priB - priA; 
                                        })

                                .map((t, index) => (
                                    <Card key={`${currentProject?.key}-${t.jira_issue_key || index}`} className="p-2 mb-1" style={{ border: "none", borderBottom: "2px solid #ccc" }}>
                                        
                                           <div style={{ textAlign: "center", fontWeight: "bold", fontSize: "16px", marginBottom: "5px" }}>
                                               🗂️ Task
                                            </div>
                                                <div style={{
                                                    textAlign: "center",
                                                    fontWeight: "bold",
                                                    fontSize: "14px",
                                                    marginBottom: "5px",
                                                    backgroundColor: "#f0f0f0",
                                                    padding: "4px 8px",
                                                    borderRadius: "6px"
                                                }}>
                                                    {t.title}
                                            </div>
                                        📅 Deadline: {t.due_date || "N/A"}<br/>
                                        ⚙️ Priority: {t.internal_priority || "N/A"} ({t.jira_priority || "N/A"})<br/>
                                        👤 {t.assignee || "Unassigned"}<br/>
                                        🧾 Status: {t.status || "Unknown"}
                                        <Button 
                                            color="link" 
                                            size="sm" 
                                            style={{ fontSize: "18px" }}
                                            onClick={() => {
                                                const { epic, stories } = findNearestEpicAndStories(t, tasks);

                                                // Unified format display function
                                                const renderTask = (label, task) => {
                                                    if (task.jira_issue_type === "Subtask") {
                                                        return `
                                                            <div style="margin: -25px 0px;">
                                                                <div style="font-size: 14px; font-weight: 600; color: #6c63ff; margin: -20px 0;">
                                                                    ${label}: ${task.title}
                                                                </div>
                                                                <div style="font-size: 13px; line-height: 1.4; margin-left: 4px;">
                                                                    👤 Assignee: ${task.assignee || 'Unassigned'}<br/>
                                                                    📅 End: ${task.due_date || 'N/A'}<br/>
                                                                    ⚙️ Priority: ${task.internal_priority || 'N/A'} (${task.jira_priority || 'N/A'})<br/>
                                                                    📌 Status: ${task.status || 'N/A'}<br/>
                                                                    📝 Description:
                                                                    <div style="margin-left: 8px; font-style: italic;">
                                                                        ${(task.description || 'No description')}
                                                                    </div>
                                                                </div>
                                                                <hr/>
                                                            </div>
                                                        `;
                                                    } else {
                                                        return `
                                                            <div style="font-size: 14px; font-weight: 600; color: #6c63ff; margin: -20px 0;">
                                                                ${label}: ${task.title}
                                                            </div>
                                                        `;
                                                    }
                                                };

                                                let html = "";
                                                if (epic) {
                                                    html += renderTask("Epic", epic);
                                                } else {
                                                    html += `<div style="font-style:italic;">❗ No Epic found</div>`;
                                                }

                                                if (stories.length > 0) {
                                                    stories.forEach((s, i) => {
                                                        html += renderTask(`Story ${i + 1}`, s);
                                                    });
                                                }else {
                                                    html += `<div style="font-style:italic;">❗ No User-Story found</div><hr/>`;
                                                }

                                                // Current task itself
                                                html += renderTask("Current Task", t);

                                                setDescContent(html);
                                                setDescModalOpen(true);
                                            }}
                                        >
                                            Task Details
                                        </Button>
                                    </Card>
                                ))}
                            </CustomCollapse>
                        </Card>
                        {/* End About card */}

                        
                        <Card className="mb-1 shadow-none border">
                            <CustomCollapse
                            title="Attached Files"
                            iconClass="ri-attachment-line"
                            isOpen={isOpen2}
                            toggleCollapse={toggleCollapse2}
                            >
                            <AttachedFiles files={files} />
                            </CustomCollapse>
                        </Card>
                        

                        {
                            props.activeUser.isGroup === true &&
                            <Card className="mb-1 shadow-none border">
                                {/* import collaps */}
                                <CustomCollapse
                                    title="Members"
                                    iconClass="ri-group-line"
                                    isOpen={isOpen3}
                                    toggleCollapse={toggleCollapse3}
                                >
                                    <Card className="p-2 mb-2">
                                        <div className="d-flex align-items-center">
                                            <div className=" align-self-center me-3">
                                                <div className="avatar-xs">
                                                    <span className="avatar-title rounded-circle bg-primary-subtle text-primary">
                                                        S
                                                    </span>
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-left">
                                                    <h5 className="font-size-14 mb-1">{t('Sera Mullar')}
                                                        <Badge color="danger" className="badge-soft-danger float-end">{t('Admin')}</Badge>
                                                    </h5>
                                                    {/* <p className="text-muted font-size-13 mb-0">{member.status}</p> */}
                                                </div>
                                            </div>
                                        </div>
                                    </Card>

                                    <Card className="p-2 mb-2">
                                        <div className="d-flex align-items-center">
                                            <div className="chat-user-img align-self-center me-2">
                                                <div className="avatar-xs">
                                                    <span className="avatar-title rounded-circle bg-primary-subtle text-primary">
                                                        O
                                                    </span>
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-left">
                                                    <h5 className="font-size-14 mb-1">{t('Ossie Wilson')}</h5>
                                                    {/* <p className="text-muted font-size-13 mb-0">{member.status}</p> */}
                                                </div>
                                            </div>
                                        </div>
                                    </Card>

                                    <Card className="p-2 mb-2">
                                        <div className="d-flex align-items-center">
                                            <div className="chat-avatar">

                                                <img src={avatar7} className="rounded-circle chat-user-img avatar-xs me-3" alt="chatvia" />
                                            </div>
                                            <div>
                                                <div className="text-left">
                                                    <h5 className="font-size-14 mb-1">{t('Paul Haynes')}</h5>
                                                    {/* <p className="text-muted font-size-13 mb-0">{member.status}</p> */}
                                                </div>
                                            </div>
                                        </div>
                                    </Card>
                                </CustomCollapse>
                            </Card>
                        }
                    </div>
                </SimpleBar>
            </div>
            
            <Modal isOpen={descModalOpen} toggle={() => setDescModalOpen(!descModalOpen)}>
                <ModalHeader style={{marginTop: '0px', marginBottom: '0px'}} toggle={() => setDescModalOpen(!descModalOpen)}>
                    Task Description
                </ModalHeader>
                <ModalBody style={{ padding: "8px" }}>
                <div 
                    dangerouslySetInnerHTML={{ __html: descContent.replace(/\n/g, "<br/>") }} 
                />
                </ModalBody>
            </Modal>

        </React.Fragment>
        
    );
}

const mapStateToProps = (state) => {
    const { users, active_user } = state.Chat;
    const { userSidebar } = state.Layout;
    return { users, active_user, userSidebar };
};

export default connect(mapStateToProps, { closeUserSidebar })(UserProfileSidebar);