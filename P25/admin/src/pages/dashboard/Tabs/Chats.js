import React, { Component } from 'react'
import { Input, InputGroup } from "reactstrap"
import { Link } from "react-router-dom"
import { connect } from "react-redux"
import CreateMeetingModal from './../../../components/CreateMeetingModal'

//simplebar
import SimpleBar from "simplebar-react"

//actions
import { setconversationNameInOpenChat, activeUser } from "../../../redux/actions"
import { setActiveMeetingId } from "../../../redux/actions"

class Chats extends Component {
    constructor(props) {
        super(props)
        this.state = {
            searchChat: "",
            recentChatList: [],
            allMeetings: [],
            isModalOpen: false,
            isAuthorized: false,
            isCreatingMeeting: false,
        }
        this.openUserChat = this.openUserChat.bind(this)
    }

    fetchMeetings = async () => {
        try {
            const token = localStorage.getItem("access_token")
            const authUser = JSON.parse(localStorage.getItem("authUser"))
            const userId = authUser?.user_id

            const response = await fetch(`http://localhost:5002/api/meetings/all?user_id=${userId}`, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json"
                }
            })

            if (!response.ok) throw new Error("Unable to get meeting lists")

            const data = await response.json()
            console.log('aaa')
            console.log(data.meetings)
            const meetings = data.meetings.map(item => ({
                id: item.meeting_id,
                timestamp: item.timestamp.substring(0, 16),
                name: `${item.title}`,
                profilePicture: "Null",
                unRead: 0,
                isTyping: false,
                status: "online"
            }))

            this.setState({ recentChatList: meetings })
        } catch (error) {
            console.error("❌ Fail to fetch meetings", error)
        }
    };

    componentDidMount() {
        this.fetchMeetings()

        var li = document.getElementById("conversation" + this.props.active_user)
        if (li) {
            li.classList.add("active")
        }
    }

    handleAuthorize = async () => {
        const token = localStorage.getItem("access_token")
        console.log('token')
        console.log(token)
        try {
            const response = await fetch("http://localhost:5002/api/oauth/jira/authorize", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`
                },
            })
            console.log('OAUTH')
            console.log(response)
            if (response.ok) {
                this.setState({ isAuthorized: true })
                const data = await response.json()
                window.location.href = data.authorization_url
            } else {
                console.error("Authorization failed")
            }
        } catch (error) {
            console.error("Request error:", error)
        }
    };

    handleDisconnect = async () => {
        const token = localStorage.getItem("access_token")
        try {
            const res = await fetch("http://localhost:5002/api/oauth/jira/disconnect", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                }
            })

            if (res.ok) {
                console.log("✅ Successfully disconnected from Jira")
            } else if (res.status === 404) {
                console.log("⚠️ No Jira connection found")
            } else {
                console.log("❌ Error disconnecting Jira:", res.status)
            }
        } catch (err) {
            console.error("Network or server error:", err)
        }
    }


    openUserChat(e, chat) {
        e.preventDefault()
        this.props.setActiveMeetingId(chat.id)

        var chatList = document.getElementById("chat-list")
        var clickedItem = e.target
        var currentli = null

        if (chatList) {
            var li = chatList.getElementsByTagName("li")
            //remove coversation user
            for (var i = 0; i < li.length; ++i) {
                if (li[i].classList.contains('active')) {
                    li[i].classList.remove('active')
                }
            }
            //find clicked coversation user
            for (var k = 0; k < li.length; ++k) {
                if (li[k].contains(clickedItem)) {
                    currentli = li[k]
                    break
                }
            }
        }

        //activation of clicked coversation user
        if (currentli) {
            currentli.classList.add('active')
        }

        var userChat = document.getElementsByClassName("user-chat")
        if (userChat) {
            if (userChat && userChat.length > 0 && userChat[0]) {
                userChat[0].classList.add("user-chat-show")
            }

        }

        //removes unread badge if user clicks
        var unread = document.getElementById("unRead" + chat.id)
        if (unread) {
            unread.style.display = "none"
        }
    }


    toggleModal = () => {
        this.setState(prevState => ({
            isModalOpen: !prevState.isModalOpen,
            isCreatingMeeting: prevState.isModalOpen ? false : prevState.isCreatingMeeting
        }))
    };



    render() {
        console.log("🔍 State recentChatList:", this.state.recentChatList)
        console.log("🔍 Redux active_user:", this.props.active_user)
        console.log("🔍 Redux active meeting id:", this.props.activeMeetingId)

        return (
            <React.Fragment>
                <div>
                    <div className="px-4 pt-4">
                        <h4 className="mb-4">Meetings</h4>
                    </div>

                    <div>
                        <h5 className="mb-3 px-3 font-size-16">Recent</h5>
                        <SimpleBar className="chat-message-list" >

                            <ul className="list-unstyled chat-list chat-user-list px-2" id="chat-list">
                                {
                                    this.state.recentChatList.map((chat, key) =>
                                        <li key={key} id={"conversation" + key} className={chat.unRead ? "unread" : chat.isTyping ? "typing" : key === this.props.active_user ? "active" : ""}>
                                            <Link to="#" onClick={(e) => this.openUserChat(e, chat)}>
                                                <div className="d-flex">
                                                    {
                                                        chat.profilePicture === "Null" ?
                                                            <div className={"chat-user-img " + chat.status + " align-self-center ms-0"}>
                                                                <div className="avatar-xs">
                                                                    <span className="avatar-title rounded-circle bg-primary-subtle text-primary">
                                                                        {chat.name.charAt(0)}
                                                                    </span>
                                                                </div>
                                                                {
                                                                    chat.status && <span className="user-status"></span>
                                                                }
                                                            </div>
                                                            :
                                                            <div className={"chat-user-img " + chat.status + " align-self-center ms-0"}>
                                                                <img src={chat.profilePicture} className="rounded-circle avatar-xs" alt="chatvia" />
                                                                {
                                                                    chat.status && <span className="user-status"></span>

                                                                }
                                                            </div>
                                                    }

                                                    <div className="flex-grow-1 overflow-hidden">
                                                        <h5 className="text-truncate font-size-15 mb-1 ms-3">{chat.name}</h5>
                                                        <p className="text-muted font-size-12 mb-1 ms-3">
                                                            Meeting ID:{chat.id}
                                                        </p>
                                                        {/* timestamp */}
                                                        <p className="text-muted font-size-12 mb-1 ms-3">
                                                            {chat.timestamp && new Date(chat.timestamp).toLocaleString()}
                                                        </p>
                                                        <p className="chat-user-message font-size-14 text-truncate mb-0 ms-3">
                                                            {
                                                                chat.isTyping ?
                                                                    <>
                                                                        typing<span className="animate-typing">
                                                                            <span className="dot ms-1"></span>
                                                                            <span className="dot ms-1"></span>
                                                                            <span className="dot ms-1"></span>
                                                                        </span>
                                                                    </>
                                                                    :
                                                                    <>
                                                                        {
                                                                            chat.messages && (chat.messages.length > 0 && chat.messages[(chat.messages).length - 1].isImageMessage === true) ? <i className="ri-image-fill align-middle me-1"></i> : null
                                                                        }
                                                                        {
                                                                            chat.messages && (chat.messages.length > 0 && chat.messages[(chat.messages).length - 1].isFileMessage === true) ? <i className="ri-file-text-fill align-middle me-1"></i> : null
                                                                        }
                                                                        {
                                                                            chat.messages && chat.messages.length > 0 ? chat.messages[(chat.messages).length - 1].message : null
                                                                        }
                                                                    </>
                                                            }



                                                        </p>
                                                    </div>
                                                    <div className="font-size-11">{chat.messages && chat.messages.length > 0 ? chat.messages[(chat.messages).length - 1].time : null}</div>
                                                    {chat.unRead === 0 ? null :
                                                        <div className="unread-message" id={"unRead" + chat.id}>
                                                            <span className="badge badge-soft-danger rounded-pill">{chat.messages && chat.messages.length > 0 ? chat.unRead >= 20 ? chat.unRead + "+" : chat.unRead : ""}</span>
                                                        </div>
                                                    }
                                                </div>
                                            </Link>
                                        </li>
                                    )
                                }
                            </ul>
                        </SimpleBar>

                    </div>
                    {/* 创建对话的按钮  功能暂时没有添加 */}

                    <div className="d-flex justify-content-center align-items-center py-0 flex-column" style={{ borderTop: "2px solid #ccc", height: "50px", marginTop: "10px" }}>
                        {/* <button type="button" className="btn btn-primary btn-lg" style={{marginTop:'45px'}} onClick={this.toggleModal}>
                            Create New Meeting
                        </button> */}
                        <button
                            type="button"
                            className="btn btn-primary btn-lg"
                            style={{ marginTop: '45px' }}
                            onClick={() => {
                                this.setState({ isCreatingMeeting: true }, this.toggleModal)
                            }}
                            disabled={this.state.isCreatingMeeting}
                        >
                            {this.state.isCreatingMeeting ? (
                                <>
                                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                    Creating...
                                </>
                            ) : (
                                "Create New Meeting"
                            )}
                        </button>
                        {/* <button type="button" class="btn btn-primary btn-lg ">Create New Meeting</button> */}
                    </div>
                    {/* <CreateMeetingModal
                        isOpen={this.state.isModalOpen}
                        toggle={this.toggleModal}
                        onCreate={(newMeetingId) => {
                            console.log("📥 新建会议 ID:", newMeetingId);
                            this.fetchMeetings(); // ✅ 刷新会议列表
                          }}
                    /> */}
                    <CreateMeetingModal
                        isOpen={this.state.isModalOpen}
                        toggle={this.toggleModal}
                        onCreate={(newMeetingId) => {
                            console.log("📥 新建会议 ID:", newMeetingId)
                            this.fetchMeetings().finally(() => {
                                this.setState({ isCreatingMeeting: false })
                            })
                        }}
                    />
                    {/* End chat-message-list */}
                </div>
            </React.Fragment>
        )
    }
}

const mapStateToProps = (state) => {
    const { activeMeetingId } = state.Chat
    return { activeMeetingId }
}

// export default connect(mapStateToProps, { setconversationNameInOpenChat, activeUser })(Chats);
export default connect(mapStateToProps, { setActiveMeetingId })(Chats)
