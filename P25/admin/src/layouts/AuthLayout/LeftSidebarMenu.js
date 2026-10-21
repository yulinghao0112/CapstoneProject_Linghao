import React, { useState } from 'react';
import { Link } from "react-router-dom";
import { Nav, NavItem, NavLink, UncontrolledTooltip, Dropdown, DropdownItem, DropdownToggle, DropdownMenu } from "reactstrap";
import classnames from "classnames";
import { connect, useDispatch, useSelector } from "react-redux";

import { setActiveTab, changeLayoutMode } from "../../redux/actions";

//Import Images
import logo from "../../assets/images/logo.svg"
import avatar1 from "../../assets/images/users/avatar-1.jpg";

//i18n
import i18n from '../../i18n';

// falgs
import { createSelector } from 'reselect';
import { useNavigate } from 'react-router-dom';

function LeftSidebarMenu(props) {
    const dispatch = useDispatch();

    const navigate = useNavigate();
    const token = localStorage.getItem("access_token");
    // Handle logout API and remove token from localStorage

    const handleLogout = async () => {
    
        try {
            const res = await fetch("http://localhost:5002/api/logout", {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                localStorage.removeItem("access_token");
                localStorage.removeItem("authUser");
                navigate("/login");
            } else {
                console.error("Backend logout failed:", res.status);
            }
        } catch (err) {
            console.error("Logout request error:", err);
        }
    };


    const selectLayoutProperties = createSelector(
        (state) => state.Layout,
        (layout) => ({
          layoutMode: layout.layoutMode,
        })
      );
      
      const { layoutMode } = useSelector(selectLayoutProperties);

    const mode =
        layoutMode === "dark"
            ? "light"
            : "dark";

    const onChangeLayoutMode = (value) => {
        if (changeLayoutMode) {
            dispatch(changeLayoutMode(value));
        }
    }

    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [dropdownOpen2, setDropdownOpen2] = useState(false);
    const [dropdownOpenMobile, setDropdownOpenMobile] = useState(false);
    const [lng, setlng] = useState("English");


    const toggle = () => setDropdownOpen(!dropdownOpen);
    const toggle2 = () => setDropdownOpen2(!dropdownOpen2);
    const toggleMobile = () => setDropdownOpenMobile(!dropdownOpenMobile);

    const toggleTab = tab => {
        props.setActiveTab(tab)
    }

    const activeTab = props.activeTab;

    /* changes language according to clicked language menu item */
    const changeLanguageAction = (lng) => {
        i18n.changeLanguage(lng);

        if (lng === "sp")
            setlng("Spanish");
        else if (lng === "gr")
            setlng("German");
        else if (lng === "rs")
            setlng("Russian");
        else if (lng === "it")
            setlng("Italian");
        else if (lng === "eng")
            setlng("English");
    }

    return (
        <React.Fragment>
            <div className="side-menu flex-lg-column me-lg-1">
                {/* LOGO */}
                <div className="navbar-brand-box">
                    <Link to="/" className="logo logo-dark">
                        <span className="logo-sm">
                            <img src={logo} alt="logo" height="30" />
                        </span>
                    </Link>

                    <Link to="/" className="logo logo-light">
                        <span className="logo-sm">
                            <img src={logo} alt="logo" height="30" />
                        </span>
                    </Link>
                </div>
                {/* end navbar-brand-box  */}

                {/* Start side-menu nav */}
                <div className="flex-lg-column my-auto">
                    <Nav className="side-menu-nav nav-pills justify-content-center" role="tablist">
                        <NavItem id="profile">
                            <NavLink id="pills-user-tab" className={classnames({ active: activeTab === 'profile' }) + " mb-2"} onClick={() => { toggleTab('profile'); }}>
                                <i className="ri-pie-chart-line"></i>
                            </NavLink>
                        </NavItem>
                        <UncontrolledTooltip target="profile" placement="top" transition={{ timeout: 0 }} autohide={false}>
                            Contribution
                        </UncontrolledTooltip>
                        <NavItem id="Chats">
                            <NavLink id="pills-chat-tab" className={classnames({ active: activeTab === 'chat' }) + " mb-2"} onClick={() => { toggleTab('chat'); }}>
                                <i className="ri-message-3-line"></i>
                            </NavLink>
                        </NavItem>
                        <UncontrolledTooltip target="Chats" placement="top" transition={{ timeout: 0 }}>
                            Chats
                        </UncontrolledTooltip>
                    
                        <NavItem id="Settings">
                            <NavLink id="pills-setting-tab" className={classnames({ active: activeTab === 'settings' })} onClick={() => { toggleTab('settings'); }}>
                                <i className="ri-settings-2-line"></i>
                            </NavLink>
                        </NavItem>
                        <UncontrolledTooltip target="Settings" placement="top" transition={{ timeout: 0 }}>
                            Settings
                        </UncontrolledTooltip>
                        <Dropdown nav isOpen={dropdownOpenMobile} toggle={toggleMobile} className="profile-user-dropdown d-inline-block d-lg-none dropup">
                            <DropdownToggle nav>
                                <img src={avatar1} alt="chatvia" className="profile-user rounded-circle" />
                            </DropdownToggle>
                            <DropdownMenu className="dropdown-menu-end">
                                <DropdownItem onClick={() => { toggleTab('profile'); }}>Profile <i className="ri-profile-line float-end text-muted"></i></DropdownItem>
                                <DropdownItem onClick={() => { toggleTab('settings'); }}>Setting <i className="ri-settings-3-line float-end text-muted"></i></DropdownItem>
                                <DropdownItem divider />
                                <DropdownItem  href = "/logout">
                                
                                    Log out <i className="ri-logout-circle-r-line float-end text-muted"></i>
                                </DropdownItem>
                            </DropdownMenu>
                        </Dropdown>
                    </Nav>
                </div>
                {/* end side-menu nav */}

                <div className="flex-lg-column d-none d-lg-block">
                    <Nav className="side-menu-nav justify-content-center">
                        <li className="nav-item">
                            <NavLink id="light-dark" className='mb-2' onClick={() => onChangeLayoutMode(mode)}>
                                <i className="ri-sun-line theme-mode-icon"></i>
                            </NavLink>
                            <UncontrolledTooltip target="light-dark" placement="right" transition={{ timeout: 0 }}>
                                Dark / Light Mode
                            </UncontrolledTooltip>
                        </li>
                        <Dropdown nav isOpen={dropdownOpen} className="nav-item btn-group dropup profile-user-dropdown" toggle={toggle}>
                            <DropdownToggle className="nav-link mb-2" tag="a">
                                <img src={avatar1} alt="" className="profile-user rounded-circle" />
                            </DropdownToggle>
                            <DropdownMenu>
                                <DropdownItem onClick={() => { toggleTab('profile'); }}>Contribution <i className="ri-pie-chart-line float-end text-muted"></i></DropdownItem>
                                <DropdownItem onClick={() => { toggleTab('settings'); }}>Setting <i className="ri-settings-3-line float-end text-muted"></i></DropdownItem>
                                <DropdownItem divider />
                                <DropdownItem href = "/logout">
                                    Log out <i className="ri-logout-circle-r-line float-end text-muted"></i>
                                </DropdownItem>
                            </DropdownMenu>
                        </Dropdown>
                    </Nav>
                </div>
                {/* Side menu user */}
            </div>
        </React.Fragment>
    );
}

const mapStatetoProps = state => {
    return {
        ...state.Layout
    };
};

export default connect(mapStatetoProps, {
    setActiveTab
})(LeftSidebarMenu);