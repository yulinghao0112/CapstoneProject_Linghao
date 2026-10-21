import React, { useState, useEffect, useRef } from 'react';
import { DropdownMenu, DropdownItem, DropdownToggle, UncontrolledDropdown, Modal, ModalHeader, ModalBody, CardBody, Button, ModalFooter, Card, Collapse } from "reactstrap";
import { connect } from "react-redux";
import { useSelector } from "react-redux";

import SimpleBar from "simplebar-react";

import withRouter from "../../../components/withRouter";
import JiraSummary from '../../../components/JiraSummary';
import TaskAnalysisModal from '../../../components/TaskAnalysisModal';

//Import Components
import UserProfileSidebar from "../../../components/UserProfileSidebar";
import SelectContact from "../../../components/SelectContact";
import UserHead from "./UserHead";
import ImageList from "./ImageList";
import ChatInput from "./ChatInput";
import FileList from "./FileList";

//actions
import { openUserSidebar, setFullUser } from "../../../redux/actions";

//Import Images
import avatar4 from "../../../assets/images/users/avatar-4.png";
import avatar1 from "../../../assets/images/users/avatar-1.png";

//i18n
import { useTranslation } from 'react-i18next';

import { v4 as uuidv4 } from 'uuid';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';


function UserChat(props) {

    const ref = useRef();

    const [modal, setModal] = useState(false);
    const [taskAnalysisModal, setTaskAnalysisModal] = useState(false);

    const tasks = [
    { title: "Design UI", due: "26/06", priority: "High" },
    { title: "Backend Integration", due: "28/06", priority: "Medium" },
    { title: "Deploy to staging", due: "30/06", priority: "Low" }
  ];


    /* intilize t variable for multi language implementation */
    const { t } = useTranslation();

    //demo conversation messages
    //userType must be required
    const activeMeetingId = useSelector(state => state.Chat.activeMeetingId);
    const [chatMessages, setChatMessages] = useState([]);
    const [meetingMaterials, setMeetingMaterials] = useState('');
    const [hasMaterials, setHasMaterials] = useState(false);
    const [allUsers] = useState(props.recentChatList);

    // console.log(firstAgentMessage)
    useEffect(() => {
        if (!activeMeetingId) {
            console.log("⚠️ No activeMeetingId set. Please select a meeting from the left sidebar.");
            setHasMaterials(false);
            return;
        }
        fetchMessages();
        fetchMeetingMaterials();
        checkHasMaterials();
    }, [activeMeetingId]);

    const fetchMessages = async () => {
        try {
            const token = localStorage.getItem("access_token");
            
            const authUser = JSON.parse(localStorage.getItem("authUser"));
            const userId = authUser?.user_id;

            const res = await fetch(`http://localhost:5002/api/meetings/${activeMeetingId}/messages?user_id=${userId}`, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json"
                }
            });

            const data = await res.json();

            setChatMessages(Array.isArray(data) ? data.map(msg => ({ ...msg, id: uuidv4() })) : []);
            setTimeout(() => {
                ref.current?.recalculate();
                if (ref.current?.el) {
                    ref.current.getScrollElement().scrollTop = ref.current.getScrollElement().scrollHeight;
                }
            }, 100);
        } catch (error) {
            console.error("Failed to load meeting messages:", error);
        }
    };

    const toggle = () => setModal(!modal);

    const addMessage = (message, type) => {
        var messageObj = null;

        let d = new Date();
        var n = d.getSeconds();

        //matches the message type is text, file or image, and create object according to it
        switch (type) {
            case "textMessage":
                messageObj = {
                    id: uuidv4(),
                    content: message,
                    speaker: "user",
                    // is_summary: false,
                    // time: "00:" + n,
                    // userType: "sender",
                    image: avatar4,
                    isFileMessage: false,
                    isImageMessage: false
                }
                break;

            case "fileMessage":
                messageObj = {
                    id: uuidv4(),
                    content: 'file: ',
                    // timestamp: new Date().toISOString(),
                    speaker: "user",
                    is_summary: false,
                    fileMessage: message.name,
                    size: message.size,
                    // userType: "sender",
                    image: avatar4,
                    isFileMessage: true,
                    isImageMessage: false
                }
                break;

            case "imageMessage":
                var imageMessage = [
                    { image: message },
                ]

                messageObj = {
                    id: uuidv4(),
                    content: 'image',
                    // timestamp: new Date().toISOString(),
                    speaker: "user",
                    is_summary: false,
                    imageMessage: imageMessage,
                    size: message.size,
                    // userType: "sender",
                    image: avatar4,
                    isImageMessage: true,
                    isFileMessage: false
                }
                break;

            default:
                break;
        }

        //add message object to chat        
        setChatMessages([...chatMessages, messageObj]);

        let copyallUsers = [...allUsers];
        copyallUsers[props.active_user].messages = [...chatMessages, messageObj];
        copyallUsers[props.active_user].isTyping = false;
        props.setFullUser(copyallUsers);

        scrolltoBottom();
    }

    function scrolltoBottom() {
        if (ref.current.el) {
            ref.current.getScrollElement().scrollTop = ref.current.getScrollElement().scrollHeight;
        }
    }


    const deleteMessage = (id) => {
        let conversation = chatMessages;

        var filtered = conversation.filter(function (item) {
            return item.id !== id;
        });

        setChatMessages(filtered);
    }

    // Get meeting materials content for task analysis
    const getMeetingMaterials = () => {
        return meetingMaterials; // Return loaded material content directly
    };

    const checkHasMaterials = async () => {
        try {
            const authUser = JSON.parse(localStorage.getItem("authUser"));
            const userId = authUser?.user_id;

            if (!userId || !activeMeetingId) {
                setHasMaterials(false);
                return;
            }

            const response = await fetch(`http://localhost:5002/api/meetings/${activeMeetingId}/has-materials`, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json"
                }
            });

            const data = await response.json();
            setHasMaterials(data.has_material || false);
        } catch (error) {
            console.error("Failed to check material status:", error);
            setHasMaterials(false);
        }
    };

    const fetchMeetingMaterials = async () => {
        try {
            const authUser = JSON.parse(localStorage.getItem("authUser"));
            const userId = authUser?.user_id;

            if (!userId || !activeMeetingId) {
                console.log("⚠️ Missing userId or activeMeetingId for materials fetch");
                setMeetingMaterials('');
                return;
            }

            const response = await fetch(`http://localhost:5002/api/meetings/${activeMeetingId}/materials?user_id=${userId}`, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json"
                }
            });

            const data = await response.json();

            if (Array.isArray(data) && data.length > 0) {
                const combinedContent = data
                    .map(material => {
                        return `=== ${material.filename} ===\n${material.content}\n`;
                    })
                    .join('\n');
                setMeetingMaterials(combinedContent);
            } else {
                setMeetingMaterials('');
            }
        } catch (error) {
            console.error("Failed to retrieve meeting materials:", error);
            setMeetingMaterials('');
        }
    };

    const handleTasksCreated = (results) => {
        console.log('Tasks created:', results);
        if (results.created_count > 0) {
            const successMessage = {
                id: uuidv4(),
                speaker: "agent",
                content: `✅ Successfully created ${results.created_count} tasks in Jira!`,
                is_summary: false,
                timestamp: new Date().toISOString()
            };
            setChatMessages(prev => [...prev, successMessage]);
        }
    };

    // Show empty state if no meeting is selected
    if (!activeMeetingId) {
        return (
            <div
                style={{
                    position: "absolute",
                    top: "50%",
                    left: "60%",
                    transform: "translate(-50%, -50%)"
                }}
            >
                <div className="meeting-hint text-muted text-center p-3 fs-3">
                    Please select a meeting to begin the conversation.
                </div>
            </div>
        );
    }

    return (
        <React.Fragment>
            <div className="user-chat w-100 overflow-hidden"style={{ display: "flex", flexDirection: "column", height: "100%" }}>

                <div className="d-lg-flex flex-grow-1" style={{ minHeight: 0 }}>
                    <div className={props.userSidebar ? "w-70 overflow-hidden position-relative" : "w-100 overflow-hidden position-relative"}style={{ flex: 3 }}>

                        {/* render user head */}
                        <UserHead  />

                        <SimpleBar
                            style={{ maxHeight: "100%" }}
                            ref={ref}
                            className="chat-conversation p-5 p-lg-4"
                            id="messages">
                            <JiraSummary initialSummaryText={""} /> 

                            <ul className="list-unstyled mb-0">


                                {    
                                    chatMessages
                                    .filter(msg => {
                                        return !msg.is_summary;
                                    })
                                    .map((chat, key) =>
                                        chat.isToday && chat.isToday === true ? <li key={"dayTitle" + key}>
                                            <div className="chat-day-title">
                                                <span className="title">Today</span>
                                            </div>
                                        </li> :
                                            (props.recentChatList[props.active_user].isGroup === true) ?
                                                <li key={key} className={chat.speaker !== "agent" ? "right" : ""}>
                                                    <div className="conversation-list">

                                                        <div className="chat-avatar">
                                                            {
                                                                chat.speaker !== "agent"
                                                                    ? <img src={avatar1} alt="chatvia" />
                                                                    : <img src={avatar4} alt="chatvia" />
                                                            }
                                                        </div>

                                                        <div className="user-chat-content">
                                                            <div className="ctext-wrap">
                                                        <div className={`ctext-wrap-content ${chat.speaker === "agent" ? "agent-message" : ""}`}>
                                                            {
                                                                chat.content &&
                                                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                                    {chat.content}
                                                                </ReactMarkdown>
                                                            }
                                                            {
                                                                chat.imageMessage &&
                                                                <ImageList images={chat.imageMessage} />
                                                            }
                                                            {
                                                                chat.fileMessage &&
                                                                <FileList fileName={chat.fileMessage} fileSize={chat.size} />
                                                            }
                                                            {
                                                                chat.isTyping &&
                                                                <p className="mb-0">
                                                                    typing
                                                                    <span className="animate-typing">
                                                                        <span className="dot ms-1"></span>
                                                                        <span className="dot ms-1"></span>
                                                                        <span className="dot ms-1"></span>
                                                                    </span>
                                                                </p>
                                                            }
                                                        </div>
                                                                {
                                                                    !chat.isTyping &&
                                                                    <UncontrolledDropdown className="align-self-start">
                                                                        <DropdownToggle tag="a" className="text-muted ms-1">
                                                                            <i className="ri-more-2-fill"></i>
                                                                        </DropdownToggle>
                                                                        <DropdownMenu>
                                                                            <DropdownItem>{t('Copy')} <i className="ri-file-copy-line float-end text-muted"></i></DropdownItem>
                                                                            <DropdownItem>{t('Save')} <i className="ri-save-line float-end text-muted"></i></DropdownItem>
                                                                            <DropdownItem onClick={toggle}>Forward <i className="ri-chat-forward-line float-end text-muted"></i></DropdownItem>
                                                                            <DropdownItem onClick={() => deleteMessage(chat.id)}>Delete <i className="ri-delete-bin-line float-end text-muted"></i></DropdownItem>
                                                                        </DropdownMenu>
                                                                    </UncontrolledDropdown>
                                                                }

                                                            </div>
                                                            {
                                                                <div className="conversation-name">{chat.speaker !== "agent" ? "Agent" : chat.speaker}</div>
                                                            }
                                                        </div>
                                                    </div>
                                                </li>
                                                :
                                                <li key={key} className={chat.speaker !== "agent" ? "right" : ""}>
                                                    <div className="conversation-list">
                                                        {
                                                            //logic for display user name and profile only once, if current and last messaged sent by same receiver
                                                            chatMessages[key + 1] ? chatMessages[key].speaker === chatMessages[key + 1].speaker ?

                                                                <div className="chat-avatar">
                                                                    <div className="blank-div"></div>
                                                                </div>
                                                                :
                                                                <div className="chat-avatar">
                                                                    {
                                                                            chat.speaker !== "agent"
                                                                                ? <img src={avatar1} alt="chatvia" />
                                                                                : <img src={avatar4} alt="chatvia" />
                                                                    }
                                                                </div>
                                                                : <div className="chat-avatar">
                                                                    {/* {chat.speaker !== "agent" ? <img src={avatar1} alt="chatvia" />  */}
                                                                        {
                                                                            chat.speaker !== "agent"
                                                                                ? <img src={avatar1} alt="chatvia" />
                                                                                : <img src={avatar4} alt="chatvia" />
                                                                        }
                                                                </div>
                                                        }


                                                        <div className="user-chat-content">
                                                            <div className="ctext-wrap">
                                                                <div className={`ctext-wrap-content ${chat.speaker === "agent" ? "agent-message" : ""}`}>
                                                                    {
                                                                        chat.content &&
                                                                         <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                                            {chat.content}
                                                                        </ReactMarkdown>
                                                                    }
                                                                    {
                                                                        chat.imageMessage &&
                                                                        // image list component
                                                                        <ImageList images={chat.imageMessage} />
                                                                    }
                                                                    {
                                                                        chat.fileMessage &&
                                                                        //file input component
                                                                        <FileList fileName={chat.fileMessage} fileSize={chat.size} />
                                                                    }
                                                                    {
                                                                        chat.isTyping &&
                                                                        <p className="mb-0">
                                                                            typing
                                                                            <span className="animate-typing">
                                                                                <span className="dot ms-1"></span>
                                                                                <span className="dot ms-1"></span>
                                                                                <span className="dot ms-1"></span>
                                                                            </span>
                                                                        </p>
                                                                    }
                                                                    {/* {
                                                                        !chat.isTyping && <p className="chat-time mb-0"><i className="ri-time-line align-middle"></i> <span className="align-middle">{chat.timestamp}</span></p>
                                                                    } */}
                                                                </div>
                                                                {
                                                                    !chat.isTyping &&
                                                                    <UncontrolledDropdown className="align-self-start ms-1">
                                                                        <DropdownToggle tag="a" className="text-muted">
                                                                            <i className="ri-more-2-fill"></i>
                                                                        </DropdownToggle>
                                                                        <DropdownMenu>
                                                                            <DropdownItem>{t('Copy')} <i className="ri-file-copy-line float-end text-muted"></i></DropdownItem>
                                                                            <DropdownItem>{t('Save')} <i className="ri-save-line float-end text-muted"></i></DropdownItem>
                                                                            <DropdownItem onClick={toggle}>Forward <i className="ri-chat-forward-line float-end text-muted"></i></DropdownItem>
                                                                            <DropdownItem onClick={() => deleteMessage(chat.id)}>Delete <i className="ri-delete-bin-line float-end text-muted"></i></DropdownItem>
                                                                        </DropdownMenu>
                                                                    </UncontrolledDropdown>
                                                                }

                                                            </div>
                                                            {
                                                                chatMessages[key + 1] ? 
                                                                chatMessages[key].speaker === chatMessages[key + 1].speaker ? null : 

                                                                <div className="conversation-name">{chat.speaker !== "agent" ? 

                                                                chat.speaker : "Agent"}</div> : 

                                                                <div className="conversation-name">{chat.speaker === "agent" ? 
                                                                
                                                                "Agent" : chat.speaker}</div>
                                                            }

                                                        </div>
                                                    </div>
                                                </li>
                                    )
                                }
                            </ul>
                        </SimpleBar>

                        <Modal backdrop="static" isOpen={modal} centered toggle={toggle}>
                            <ModalHeader toggle={toggle}>Forward to...</ModalHeader>
                            <ModalBody>
                                <CardBody className="p-2">
                                    <SimpleBar style={{ maxHeight: "200px" }}>
                                        <SelectContact handleCheck={() => { }} />
                                    </SimpleBar>
                                    <ModalFooter className="border-0">
                                        <Button color="primary">Forward</Button>
                                    </ModalFooter>
                                </CardBody>
                            </ModalBody>
                        </Modal>

                        {/* Task Analysis Button */}
                        <div className="p-3 border-top d-flex justify-content-between align-items-center">
                            <div className="text-muted small">
                                💡 Tip: Generate Jira tasks from your meeting discussion
                            </div>
                            <Button 
                                color="primary" 
                                size="sm"
                                onClick={() => setTaskAnalysisModal(true)}
                                disabled={!hasMaterials}
                                title={!hasMaterials ? "Please upload meeting materials first" : "Analyze meeting materials and create tasks"}
                            >
                                🤖 Analyze & Create Tasks
                                {!hasMaterials && <span className="text-muted ms-1">(No Materials)</span>}
                            </Button>
                        </div>

                        <ChatInput onaddMessage={addMessage} onFetchMessages={fetchMessages} onMaterialUploaded={checkHasMaterials}/>
                    </div>

                    <UserProfileSidebar activeUser={props.recentChatList[props.active_user]} />

                </div>
            </div>

            {/* Task Analysis Modal */}
            <TaskAnalysisModal
                isOpen={taskAnalysisModal}
                toggle={() => setTaskAnalysisModal(false)}
                meetingId={activeMeetingId}
                userId={JSON.parse(localStorage.getItem("authUser"))?.user_id}
                onTasksCreated={handleTasksCreated}
            />
        </React.Fragment>
    );
}

const mapStateToProps = (state) => {
    const { active_user } = state.Chat;
    const { userSidebar } = state.Layout;
    return { active_user, userSidebar };
};

export default withRouter(connect(mapStateToProps, { openUserSidebar, setFullUser })(UserChat));

