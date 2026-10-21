import React, { useState } from 'react';
import { Dropdown, DropdownMenu, DropdownItem, DropdownToggle, Button, Input, Row, Col, Modal, ModalBody } from "reactstrap";
import { Link } from "react-router-dom";
import { connect } from "react-redux";
import { useSelector } from 'react-redux';
import AlertModal from '../../../components/AlertModal';
import { Tooltip } from "reactstrap";


import { openUserSidebar, setFullUser } from "../../../redux/actions";

//import images
import user from '../../../assets/images/users/avatar-4.jpg'

function UserHead(props) {
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [dropdownOpen1, setDropdownOpen1] = useState(false);
    const [Callmodal, setCallModal] = useState(false);
    const [Videomodal, setVideoModal] = useState(false);

    const toggle = () => setDropdownOpen(!dropdownOpen);
    const toggle1 = () => setDropdownOpen1(!dropdownOpen1);
    const toggleCallModal = () => setCallModal(!Callmodal);
    const toggleVideoModal = () => setVideoModal(!Videomodal);

    const [modalOpen, setModalOpen] = useState(false);
    const [modalTitle, setModalTitle] = useState('');
    const [modalMessage, setModalMessage] = useState('');
    const [tooltipOpen, setTooltipOpen] = useState(false);
    const [tooltipReminderOpen, setTooltipReminderOpen] = useState(false);
    const [onModalConfirm, setOnModalConfirm] = useState(() => () => {});

    const openUserSidebar = (e) => {
        e.preventDefault();
        props.openUserSidebar();
    }

    function closeUserChat(e) {
        e.preventDefault();
        var userChat = document.getElementsByClassName("user-chat");
        if (userChat) {
            userChat[0].classList.remove("user-chat-show");
        }
    }

    function deleteMessage() {
        let allUsers = props.users;
        let copyallUsers = allUsers;
        copyallUsers[props.active_user].messages = [];

        props.setFullUser(copyallUsers);
    }

const meeting_id = useSelector( state => state.Chat.activeMeetingId);

const [showDelete, setShowDelete] = useState(false);

const authUser = JSON.parse(localStorage.getItem("authUser"));

// if (authUser) {
const user_id = authUser.user_id;

React.useEffect(() => {
    const fetchNextMeetingId = async () => {
        try {
            // const res = await fetch("http://localhost:5002/api/meetings/next-id");
            const res = await fetch(`http://localhost:5002/api/meetings/next-id?user_id=${user_id}`);
            const data = await res.json();
            if (res.ok && data.next_meeting_id !== undefined) {
                setShowDelete(data.next_meeting_id - 1 === meeting_id);
            }
        } catch (err) {
            console.error("Failed to fetch next meeting ID", err);
        }
    };

    if (meeting_id !== undefined) {
        fetchNextMeetingId();
    }
}, [meeting_id]);

const handleDeleteMeeting = async () => {

if (!user_id || !meeting_id) {
    console.error("Missing user_id or meeting_id");
    return;
}
const res = await fetch("http://localhost:5002/api/meetings/delete", {
    method: "POST",
    headers: {
        "Content-Type": "application/json"
    },
    body: JSON.stringify({
        user_id: parseInt(user_id),
        meeting_id
    })
});
const result = await res.json();
console.log("🗑️ Meeting deletion result:", result);
if (res.ok) {
    setModalTitle("Meeting Deleted");
    setModalMessage("✅ Meeting deleted successfully");
    setModalOpen(true);
    setOnModalConfirm(() => () => {
        window.location.reload();
    });
} else {
    setModalTitle("Delete Failed");
    setModalMessage(result.msg || "❌ Failed to delete meeting");
    setModalOpen(true);
}
};
    return (
        <React.Fragment>
            <AlertModal
                isOpen={modalOpen}
                toggle={() => setModalOpen(!modalOpen)}
                title={modalTitle}
                message={modalMessage}
                onConfirm={() => {
                    onModalConfirm();
                    setModalOpen(false);
                }}
            />
            <div className="p-3 p-lg-4 border-bottom user-chat-topbar">
                <Row className="align-items-center">
                    <Col sm={4} xs={8}>
                        <div className="d-flex align-items-center">
                            <div className="d-block d-lg-none me-2 ms-0">
                                <Link to="#" onClick={(e) => closeUserChat(e)} className="user-chat-remove text-muted font-size-16 p-2">
                                    <i className="ri-arrow-left-s-line"></i></Link>
                            </div>
                            {
                                props.users[props.active_user].profilePicture !== "Null" ?
                                    <div className="me-3 ms-0">
                                        <img src={props.users[props.active_user].profilePicture} className="rounded-circle avatar-xs" alt="chatvia" />
                                    </div>
                                    : <div className="chat-user-img align-self-center me-3">
                                        <div className="avatar-xs">
                                            <span className="avatar-title rounded-circle bg-primary-subtle text-primary">
                                                {props.users[props.active_user].name.charAt(0)}
                                            </span>
                                        </div>
                                    </div>
                            }

                            <div className="flex-grow-1 overflow-hidden">
                                <h5 className="font-size-16 mb-0 text-truncate">
                                    <Link to="#" onClick={(e) => openUserSidebar(e)} className="text-reset user-profile-show">
                                        {props.users[props.active_user].name}
                                    </Link>
                                    {(() => {
                                        switch (props.users[props.active_user].status) {
                                            case "online":
                                                return (
                                                    <>
                                                        <i className="ri-record-circle-fill font-size-10 text-success d-inline-block ms-2"></i>
                                                    </>
                                                )

                                            case "away":
                                                return (
                                                    <>
                                                        <i className="ri-record-circle-fill font-size-10 text-warning d-inline-block ms-1"></i>
                                                    </>
                                                )

                                            case "offline":
                                                return (
                                                    <>
                                                        <i className="ri-record-circle-fill font-size-10 text-secondary d-inline-block ms-1"></i>
                                                    </>
                                                )

                                            default:
                                                return;
                                        }
                                    })()}

                                </h5>
                            </div>
                        </div>
                    </Col>
                    <Col sm={8} xs={4} >
                        <ul className="list-inline user-chat-nav text-end mb-0">

                            <li className="list-inline-item">
                    <Dropdown isOpen={dropdownOpen} toggle={toggle}>
                        {showDelete && (
                            <>
                                <DropdownToggle
                                    id="DeleteButton"
                                    color="none"
                                    className="btn nav-btn"
                                    type="button"
                                    onClick={handleDeleteMeeting}
                                >
                                    <i className="ri-delete-bin-line"></i>
                                </DropdownToggle>
                                <Tooltip
                                    placement="top"
                                    isOpen={tooltipOpen}
                                    target="DeleteButton"
                                    toggle={() => setTooltipOpen(!tooltipOpen)}
                                >
                                    Delete
                                </Tooltip>
                            </>
                        )}
                    </Dropdown>
                </li>

                    <li className="list-inline-item d-none d-lg-inline-block me-2 ms-0">
                        <>
                            <Button
                                id="ReminderButton"
                                type="button"
                                color="none"
                                onClick={(e) => openUserSidebar(e)}
                                className="nav-btn user-profile-show"
                            >
                                <i className="ri-user-2-line"></i>
                            </Button>
                            <Tooltip
                                placement="top"
                                isOpen={tooltipReminderOpen}
                                target="ReminderButton"
                                toggle={() => setTooltipReminderOpen(!tooltipReminderOpen)}
                            >
                                Reminder
                            </Tooltip>
                        </>
                    </li>
                    </ul>
                    </Col>
                </Row>
            </div>

            {/* Start Audiocall Modal */}
            <Modal tabIndex="-1" isOpen={Callmodal} toggle={toggleCallModal} centered>
                <ModalBody>
                    <div className="text-center p-4">
                        <div className="avatar-lg mx-auto mb-4">
                            <img src={user} alt="" className="img-thumbnail rounded-circle" />
                        </div>

                        <h5 className="text-truncate">Doris Brown</h5>
                        <p className="text-muted">Start Audio Call</p>

                        <div className="mt-5">
                            <ul className="list-inline mb-1">
                                <li className="list-inline-item px-2 me-2 ms-0">
                                </li>
                                <li className="list-inline-item px-2">
                                </li>
                            </ul>
                        </div>
                    </div>
                </ModalBody>
            </Modal>

            {/* Start VideoCall Modal */}
            <Modal tabIndex="-1" isOpen={Videomodal} toggle={toggleVideoModal} centered>
                <ModalBody>
                    <div className="text-center p-4">
                        <div className="avatar-lg mx-auto mb-4">
                            <img src={user} alt="" className="img-thumbnail rounded-circle" />
                        </div>

                        <h5 className="text-truncate">Doris Brown</h5>
                        <p className="text-muted">Start Video Call</p>

                        <div className="mt-5">
                            <ul className="list-inline mb-1">
                                <li className="list-inline-item px-2 me-2 ms-0">
                                    <button type="button" className="btn btn-danger avatar-sm rounded-circle" onClick={toggleVideoModal}>
                                        <span className="avatar-title bg-transparent font-size-20">
                                            <i className="ri-close-fill"></i>
                                        </span>
                                    </button>
                                </li>
                                <li className="list-inline-item px-2">
                                    <button type="button" className="btn btn-success avatar-sm rounded-circle">
                                        <span className="avatar-title bg-transparent font-size-20">
                                            <i className="ri-vidicon-fill"></i>
                                        </span>
                                    </button>
                                </li>
                            </ul>
                        </div>
                    </div>
                </ModalBody>
            </Modal>
        </React.Fragment>
    );
}


const mapStateToProps = (state) => {
    const { users, active_user } = state.Chat;
    return { ...state.Layout, users, active_user };
};

export default connect(mapStateToProps, { openUserSidebar, setFullUser })(UserHead);