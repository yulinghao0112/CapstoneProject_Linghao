import React, { useState, useEffect } from 'react';
import { Card, Button } from "reactstrap";
import SimpleBar from "simplebar-react";
import { useTranslation } from 'react-i18next';
import avatar1 from "../../../assets/images/users/avatar-1.jpg";
import CustomCollapse from "../../../components/CustomCollapse";
import AlertModal from '../../../components/AlertModal';

function Settings() {
  const [isOpen1, setIsOpen1] = useState(true);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    fetch("http://localhost:5002/api/oauth/jira/status", {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.connected === true) {
          setIsConnected(true);
        }
      })
      .catch(err => console.error("Error checking status", err));
  }, []);

  const handleAuthorize = async () => {
    const token = localStorage.getItem("access_token");
    try {
      const response = await fetch("http://localhost:5002/api/oauth/jira/authorize", {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        window.location.href = data.authorization_url;
      } else {
        console.error("Authorization failed");
      }
    } catch (error) {
      console.error("Request error:", error);
    }
  };



  const handleDisconnect = async () => {
    const token = localStorage.getItem("access_token");
    try {
          const projectRes = await fetch("http://localhost:5002/api/jira-oauth/my-projects", {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });

        if (!projectRes.ok) {
          throw new Error("Failed to retrieve project");
        }

        const projectData = await projectRes.json();
        const project = projectData.projects?.[0];

        if (project?.key) {
          const delRes = await fetch(`http://localhost:5002/api/jira-oauth/project-preferences/${project.key}`, {
            method: "DELETE",
            headers: {
              "Authorization": `Bearer ${token}`
            }
          });
    
          if (!delRes.ok) {
            throw new Error("Delete project failed");
          }
        }  

      const res = await fetch("http://localhost:5002/api/oauth/jira/disconnect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        }
      });
      if (res.ok) {
        console.log("✅ Successfully disconnected from Jira");
        setIsConnected(false);
        setIsAlertOpen(true);
      }
    } catch (err) {
      console.error("Network or server error:", err);
    }
  };

  const authUser = JSON.parse(localStorage.getItem('authUser')) || {};
  const { email, username } = authUser;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="px-4 pt-4">
        <h4 className="mb-0">{t('Settings')}</h4>
      </div>

      <div className="text-center border-bottom p-4">
        <div className="mb-4 profile-user">
          <img src={avatar1} className="rounded-circle avatar-lg img-thumbnail" alt="chatvia" />
        </div>
        <h5 className="font-size-16 mb-1 text-truncate">{username}</h5>
      </div>

      <div style={{ flexGrow: 1, minHeight: 0 }}>
        <SimpleBar style={{ height: '100%' }} className="p-4 user-profile-desc">
          <div className="custom-accordion">
            <Card className="accordion-item border mb-3">
              <CustomCollapse title="Personal Info" isOpen={isOpen1} toggleCollapse={() => setIsOpen1(!isOpen1)}>
                <div>
                  <p className="text-muted mb-1">{t('Name')}</p>
                  <h5 className="font-size-14">{username}</h5>
                </div>
                <div className="mt-3">
                  <p className="text-muted mb-1">{t('Email')}</p>
                  <h5 className="font-size-14">{email}</h5>
                </div>
              </CustomCollapse>
            </Card>
          </div>

          <div className="mt-4 d-flex flex-column gap-2 align-items-center">
            <Button color="primary" size="lg" onClick={handleAuthorize}>
              Authorize with Jira
            </Button>

            <Button
              color={isConnected ? "danger" : "secondary"}
              size="lg"
              onClick={handleDisconnect}
              disabled={!isConnected}
            >
              Disconnect
            </Button>
          </div>
        </SimpleBar>

        <AlertModal
          isOpen={isAlertOpen}
          toggle={() => setIsAlertOpen(false)}
          title="Disconnected"
          message="You have successfully disconnected from Jira."
          onConfirm={() => setIsAlertOpen(false)}
        />
      </div>
    </div>
  );
}

export default Settings;
