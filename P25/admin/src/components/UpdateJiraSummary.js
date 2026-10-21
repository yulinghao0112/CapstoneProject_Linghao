import React, { useState } from 'react';
import { Collapse, Button, CardBody,Card,CardHeader } from 'reactstrap';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const JiraSummary = ({ summaryText }) => {
  const [isOpen, setIsOpen] = useState(true);

  const toggle = () => setIsOpen(!isOpen);

  const priorityColor = {
    High: 'success',
    Medium: 'warning',
    Low: 'primary'
  };


  return (
    <Card className="mb-3 shadow-sm sticky-summary">
      <CardHeader onClick={toggle} style={{ cursor: 'pointer' }} className="d-flex justify-content-between align-items-center">
        <div className="fw-bold d-flex align-items-center gap-2 jira-summary">
          <i className="ri-task-line text-primary fs-5"></i>
          Update JIRA
        </div>
        <i className={`ri-arrow-${isOpen ? 'up' : 'down'}-s-line text-muted fs-5`}></i>
      </CardHeader>

      <Collapse isOpen={isOpen}>
        <CardBody className="pt-3 pb-2">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{summaryText}</ReactMarkdown>
        </CardBody>
      </Collapse>
    </Card>
  );
};

export default JiraSummary;