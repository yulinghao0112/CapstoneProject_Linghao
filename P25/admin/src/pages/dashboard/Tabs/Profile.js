import React, { useState, useEffect } from "react";
// import { PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import {BarChart, Bar, XAxis, YAxis, Cell ,CartesianGrid, Tooltip, LabelList, Legend, ResponsiveContainer } from 'recharts';
import {
  Dropdown,
  DropdownMenu,
  DropdownItem,
  DropdownToggle,
  Card,
} from "reactstrap";

//Import components
import CustomCollapse from "../../../components/CustomCollapse";
import AttachedFiles from "../../../components/AttachedFiles";

//Import Images
import avatar1 from "../../../assets/images/users/avatar-1.jpg";

//i18n
import { useTranslation } from "react-i18next";

function Profile(_props) {
  const [availableSprints, setAvailableSprints] = useState([]);
  const [selectedSprints, setSelectedSprints] = useState(['all']);  // Array of selected sprint IDs

  const handleSprintChange = (event, sprintId) => {
    if (event.target.checked) {
      setSelectedSprints(prev => [...prev, sprintId]);
    } else {
      setSelectedSprints(prev => prev.filter(id => id !== sprintId));
    }
  };
  useEffect(() => {
    fetchContribution(null);
  }, []);

  const [selectedMember, setSelectedMember] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [contributionData, setContributionData] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isOpen1, setIsOpen1] = useState(true);
  const [isOpen2, setIsOpen2] = useState(false);
  const [files] = useState([
    { name: "Admin-A.zip", size: "12.5 MB", thumbnail: "ri-file-text-fill" },
    { name: "Image-1.jpg", size: "4.2 MB", thumbnail: "ri-image-fill" },
    { name: "Image-2.jpg", size: "3.1 MB", thumbnail: "ri-image-fill" },
    { name: "Landing-A.zip", size: "6.7 MB", thumbnail: "ri-file-text-fill" },
  ]);
  const [progressData, setProgressData] = useState([]);

  const [assigneeColors, setAssigneeColors] = useState({});
  useEffect(() => {
    if (contributionData?.members) {
      const colors = {};
      contributionData.members.forEach((member, idx) => {
        colors[member.assignee] = COLORS[idx % COLORS.length];
      });
      setAssigneeColors(colors);
    }
  }, [contributionData]);

  useEffect(() => {
    const fetchSprints = async () => {
      try {
        const res = await fetch("http://localhost:5002/api/jira-oauth/available-sprints", {
          method: "GET",
          headers: {
            "Authorization": "Bearer " + localStorage.getItem("access_token")
          }
        });
        if (!res.ok) throw new Error("Failed to fetch sprints");
        const json = await res.json();
        setAvailableSprints(json.available_sprints);
        console.error("AVALIABLE SPRINT:", json);
      } catch (err) {
        console.error("❌ Error fetching sprints:", err);
        setAvailableSprints([]);
      }
    };
  
    fetchSprints();
  }, []);

  /* intilize t variable for multi language implementation */
  const { t } = useTranslation();

  const handleMemberClick = (member) => {
    setSelectedMember(member);
    setShowModal(true);
  };

  const toggleCollapse1 = () => {
    setIsOpen1(!isOpen1);
    setIsOpen2(false);
  };

  const toggleCollapse2 = () => {
    setIsOpen2(!isOpen2);
    setIsOpen1(false);
  };

  const toggle = () => setDropdownOpen(!dropdownOpen);
  const authUserStr = localStorage.getItem('authUser');
  console.log(authUserStr)
  const authUser = JSON.parse(authUserStr);
  const email = authUser.email;
  const username = authUser.username;

  const COLORS = [
    '#0088FE',
    '#00C49F',
    '#FFBB28',
    '#FF8042',
    '#d87093',
    '#87cefa',
    '#a0522d',
    '#7b68ee',
    '#3cb371',
    '#ff6347' 
  ];

  const fetchContribution = async (sprintId = null) => {
    const query = sprintId ? `?sprint_id=${sprintId}` : ""; 
  
    try {
      const res = await fetch(`http://localhost:5002/api/jira-oauth/contribution-stats${query}`, {
        method: "GET",
        headers: {
          "Authorization": "Bearer " + localStorage.getItem("access_token")
        }
      });
  
      if (!res.ok) throw new Error("Failed to fetch contribution stats");
  
      const json = await res.json();
      console.log("✅ Contribution data:", json);
      setContributionData(json);
    } catch (err) {
      console.error("❌ Error fetching contribution stats:", err);
      setContributionData({ error: true });
    }
  };


  useEffect(() => {
    if (!contributionData || !contributionData.members) return;
  
    let done = 0;
    let todo = 0;
  
    contributionData.members.forEach(member => {
      member.tasks?.forEach(task => {
        if (task.status === "Done") done++;
        else if (task.status === "To Do") todo++;
      });
    });
  
    const total = done + todo;
    const donePercent = total > 0 ? ((done / total) * 100).toFixed(1) : 0;
    const todoPercent = total > 0 ? ((todo / total) * 100).toFixed(1) : 0;
  
    setProgressData([
      { name: "Done", count: done, percent: donePercent },
      { name: "To Do", count: todo, percent: todoPercent },
    ]);
  }, [contributionData]);

  const pieData = Array.isArray(contributionData?.members)
  ? contributionData.members.map((item, _index) => ({
      name: item.assignee,
      value: item.percentage,
      totalScore: item.total_score,
    }))
  : [];

  const assigneeBarData = Array.isArray(contributionData?.members)
  ? contributionData.members.map(member => {
      const done = member.tasks.filter(task => task.status === "Done").length;
      const todo = member.tasks.filter(task => task.status === "To Do").length;
      const total = done + todo;

      return {
        name: member.assignee,
        Done: total > 0 ? (done / total) * 100 : 0,
        ToDo: total > 0 ? (todo / total) * 100 : 0,
        originalDone: done, 
        originalToDo: todo, 
        totalTasks: total   
      };
    })
  : [];


  const renderAssigneeLegend = () => {
    if (!contributionData?.members) return null;
  
    return (
      <ul style={{ listStyle: 'none', padding: 0, marginLeft: 40, display: 'flex', flexWrap: 'wrap' }}>
        {contributionData.members.map((m, idx) => (
          <li key={m.assignee} style={{ display: 'flex', alignItems: 'center', marginRight: 16 }}>
            <span
              style={{
                display: 'inline-block',
                width: 12,
                height: 12,
                backgroundColor: COLORS[idx % COLORS.length],
                marginRight: 6,
              }}
            />
            <span style={{ fontSize: 12 }}>{m.assignee}</span>
          </li>
        ))}
      </ul>
    );
  };
  

  const renderLegend = (props) => {
    const { payload } = props;
    return (
      <ul style={{ 
            listStyle: 'none', 
            padding: 0, 
            marginLeft: '200px', 
            display: 'flex', 
            flexWrap: 'wrap', 
            justifyContent: 'center' }}>
        {payload.map((entry, index) => (
          <li
            key={`item-${index}`}
            style={{
              color: entry.color,
              fontSize: '12px',
              lineHeight: '24px',
              marginBottom: '2px',
              marginRight: '85px',
              
            }}
          >
            <span style={{ display: 'inline-block', width: 10, height: 12, backgroundColor: entry.color, marginRight: 8 }} />
            {entry.value}
          </li>
        ))}
      </ul>
    );
  };

  return (
    <React.Fragment>
      <div>
        <div className="px-4 pt-4">
          <div className="user-chat-nav float-end">
          </div>
          <h4 className="mb-0">{t("Contribution")}</h4>
        </div>
                
        {/* Start user-profile-desc */}
        <div className="p-4 user-profile-desc">
          <div className="text-muted">
            <p className="mb-4">
              {t(
                ""
              )}
            </p>
          </div>

          <div className="mb-3">
            <h5>Select Sprint</h5>

            <div>
              <label>
                <input
                  type="radio"
                  name="selectedSprint"
                  value="all"
                  checked={selectedSprints[0] === 'all'}
                  onChange={() => {
                    setSelectedSprints(['all']);
                    fetchContribution(null);
                  }}
                />
                All Sprints
              </label>
            </div>

            {availableSprints.map(sprint => (
              <div key={sprint.id}>
                <label>
                  <input
                    type="radio"
                    name="selectedSprint"
                    value={sprint.id}
                    checked={selectedSprints[0] === sprint.id}
                    onChange={() => {
                      setSelectedSprints([sprint.id]);
                      fetchContribution(sprint.id);
                    }}
                  />
                  {sprint.name} ({sprint.task_count} tasks)
                </label>
              </div>
            ))}
          </div>


            <div id="profile-user-accordion-1" className="container py-3">
            <div className="mb-4"> 
              <h5 className="mb-3">Overall Progress</h5>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={progressData}
                  layout="vertical"
                  margin={{ top: 5, right: 10, left: -15, bottom: 5 }}
                >
                  <XAxis type="number" />
                  <YAxis
                    dataKey="name"
                    type="category"
                    tick={{ fontSize: 11, width: 40, textAnchor: 'end' }}
                    tickLine={false}
                  />
                  <Tooltip formatter={(value, name) => [`${value} tasks`, name]} />
                  <Bar dataKey="count">
                    <Cell fill="#82ca9d" /> 
                    <Cell fill="#8884d8" /> 
                    <LabelList dataKey="percent" position="insideRight" style={{ fill: 'black', fontSize: 8 }} formatter={(value) => `${value}%`} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="mb-4">
              <h5 className="mb-3">Individual Progress</h5>
              <ResponsiveContainer width="100%" height={300}>
              <BarChart
                layout="vertical"
                data={assigneeBarData}
                margin={{ top: 20, right: 20, left: -60, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={(tick) => `${tick}%`}/>
                <YAxis
                  type="category"
                  dataKey="name"
                  axisLine={false}
                  tick={false}
                />
                <Tooltip 
                  formatter={(value, name, props) => {
                    const { payload } = props;
                    const percentage = value.toFixed(1) + "%";
                    if (name === "Done") {
                      return [`${percentage} (${payload.originalDone} tasks)`, "Done"];
                    }
                    if (name === "ToDo") {
                      return [`${percentage} (${payload.originalToDo} tasks)`, "To Do"];
                    }
                    return [percentage, name];
                  }}
                />

                <Legend content={renderAssigneeLegend} verticalAlign="bottom" />
                <Bar dataKey="Done" stackId="a">
                  {assigneeBarData.map((entry, index) => (
                    <Cell key={`done-${index}`} fill={assigneeColors[entry.name]} />
                  ))}
                </Bar>
                <Bar dataKey="ToDo" stackId="a">
                  {assigneeBarData.map((entry, index) => (
                    <Cell key={`todo-${index}`} fill={assigneeColors[entry.name]} fillOpacity={0.4} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            </div>
          </div>

                </div>
              </div>
    </React.Fragment>
    
  );
}

export default Profile;
