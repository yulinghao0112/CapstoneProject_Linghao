import React, { useState, useEffect, useCallback } from 'react'
import { Modal, ModalHeader, ModalBody, ModalFooter, Button, Form, FormGroup, Label, Input, Alert, Spinner, Badge, Progress } from 'reactstrap'
import { APIClient } from '../helpers/apiClient'

const TaskAnalysisModal = ({
    isOpen,
    toggle,
    meetingId,
    userId,
    meetingContent,
    onTasksCreated
}) => {

    const [loading, setLoading] = useState(false)
    const [step, setStep] = useState('parsing') // 'parsing', 'editing', 'creating'
    const [parsedTasks, setParsedTasks] = useState([])
    const [meetingSummary, setMeetingSummary] = useState('')
    const [rawAnalysis, setRawAnalysis] = useState('')  // Add raw analysis content
    const [error, setError] = useState('')
    const [creationResults, setCreationResults] = useState(null)

    // Analysis progress state
    const [analysisProgress, setAnalysisProgress] = useState(0)
    const [currentAnalysisStep, setCurrentAnalysisStep] = useState('')
    const [analysisStartTime, setAnalysisStartTime] = useState(null)

    // Analysis steps with interesting hints
    const analysisSteps = [
        { progress: 10, message: "Reading meeting transcripts..." },
        { progress: 25, message: "Understanding context and participants..." },
        { progress: 40, message: "Extracting actionable tasks..." },
        { progress: 55, message: "Identifying task assignments..." },
        { progress: 70, message: "Categorizing by domain (Frontend/Backend/Testing)..." },
        { progress: 85, message: "Setting priorities and deadlines..." },
        { progress: 95, message: "Finalizing User Stories and Subtasks..." }
    ]

    // Progress simulator
    const startProgressSimulation = () => {
        let stepIndex = 0

        const progressInterval = setInterval(() => {
            if (stepIndex < analysisSteps.length) {
                const currentStep = analysisSteps[stepIndex]
                setAnalysisProgress(currentStep.progress)
                setCurrentAnalysisStep(currentStep.message)
                stepIndex++
            } else {
                clearInterval(progressInterval)
                // Stay at 95% until actual API returns
                setAnalysisProgress(95)
                setCurrentAnalysisStep("🔄 Processing AI response...")
            }
        }, 2000) // Update every 2 seconds

        // Store interval ID for cleanup
        window.analysisProgressInterval = progressInterval
    }

    const parseTasksFromContent = async () => {

        // Pre-checks
        if (!meetingId) {
            setError('Meeting ID is missing. Please select a meeting.')
            return
        }

        if (!userId) {
            setError('User ID is missing. Please log in again.')
            return
        }

        // Pre-checks moved to backend, no longer checking meetingContent here

        setLoading(true)
        setError('')
        setAnalysisProgress(0)
        setAnalysisStartTime(Date.now())

        // Start progress simulator
        startProgressSimulation()

        // Add 60 second timeout control
        const controller = new AbortController()
        const timeoutId = setTimeout(() => {
            controller.abort()
            setError('Request timeout after 60 seconds. Please try again.')
            setLoading(false)
        }, 60000)

        try {

            const response = await fetch(`http://localhost:5002/api/meetings/${meetingId}/parse-tasks`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    user_id: userId
                }),
                signal: controller.signal // Add abort signal
            })

            clearTimeout(timeoutId) // Clear timeout

            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('Meeting not found. Please make sure you have uploaded meeting materials first.')
                } else if (response.status === 500) {
                    throw new Error('Server error occurred while analyzing tasks. Please try again later.')
                } else {
                    throw new Error(`Task analysis failed. Please check your connection and try again.`)
                }
            }

            const data = await response.json()

            if (data.success) {
                // Clean up progress simulator
                if (window.analysisProgressInterval) {
                    clearInterval(window.analysisProgressInterval)
                }
                setAnalysisProgress(100)
                setCurrentAnalysisStep("✅ Analysis complete!")

                setMeetingSummary(data.meeting_summary)
                setRawAnalysis(data.raw_analysis || '')  // Save raw analysis content
                setParsedTasks(data.parsed_tasks.user_stories || [])  // Now it's user_stories array
                setStep('editing')
            } else {
                setError(data.error || 'Failed to parse tasks')
            }
        } catch (err) {
            clearTimeout(timeoutId) // Clear timeout

            // Clean up progress simulator
            if (window.analysisProgressInterval) {
                clearInterval(window.analysisProgressInterval)
            }

            if (err.name === 'AbortError') {
                setError('Request timeout. Please try again.')
            } else {

                let errorMessage = 'Network error occurred'
                if (err.message.includes('Meeting not found') || err.message.includes('Server error occurred')) {
                    errorMessage = err.message
                } else if (err.message.includes('Failed to fetch')) {
                    errorMessage = 'Cannot connect to server. Please check if backend is running.'
                } else {
                    errorMessage = 'An unexpected error occurred. Please try again.'
                }
                setError(errorMessage)
            }
        } finally {
            clearTimeout(timeoutId) // Ensure timeout is cleared
            setLoading(false)
        }
    }

    // Function to reset Modal state
    const resetModalState = () => {
        // Clean up progress simulator
        if (window.analysisProgressInterval) {
            clearInterval(window.analysisProgressInterval)
        }

        setLoading(false)
        setStep('parsing')
        setParsedTasks([])
        setMeetingSummary('')
        setRawAnalysis('')
        setError('')
        setCreationResults(null)

        // Reset progress state
        setAnalysisProgress(0)
        setCurrentAnalysisStep('')
        setAnalysisStartTime(null)
    }

    // Listen for meetingId changes, reset state
    useEffect(() => {
        if (meetingId) {
            resetModalState()
        }
    }, [meetingId])

    // Listen for Modal open state, start fresh analysis each time opened
    useEffect(() => {
        if (isOpen && meetingId && userId) {
            resetModalState() // Reset state each time Modal opens
            // Use setTimeout to ensure state reset completes before starting analysis
            setTimeout(() => {
                parseTasksFromContent()
            }, 50)
        }
        
        // Cleanup function to clear intervals on unmount or when modal closes
        return () => {
            if (window.analysisProgressInterval) {
                clearInterval(window.analysisProgressInterval)
                window.analysisProgressInterval = null
            }
        }
    }, [isOpen]) // Only listen to isOpen, ensure trigger on each open

    const updateUserStory = (storyIndex, field, value) => {
        const updatedStories = [...parsedTasks]
        updatedStories[storyIndex] = { ...updatedStories[storyIndex], [field]: value }
        setParsedTasks(updatedStories)
    }

    const updateSubtask = (storyIndex, subtaskIndex, field, value) => {
        const updatedStories = [...parsedTasks]
        const updatedSubtasks = [...updatedStories[storyIndex].subtasks]
        updatedSubtasks[subtaskIndex] = { ...updatedSubtasks[subtaskIndex], [field]: value }
        updatedStories[storyIndex] = { ...updatedStories[storyIndex], subtasks: updatedSubtasks }
        setParsedTasks(updatedStories)
    }

    // Remove Subtask
    const removeSubtask = (storyIndex, subtaskIndex) => {
        const updatedStories = [...parsedTasks]
        const updatedSubtasks = updatedStories[storyIndex].subtasks.filter((_, i) => i !== subtaskIndex)
        updatedStories[storyIndex] = { ...updatedStories[storyIndex], subtasks: updatedSubtasks }
        setParsedTasks(updatedStories)
    }

    // Remove User Story
    const removeUserStory = (storyIndex) => {
        const updatedStories = parsedTasks.filter((_, i) => i !== storyIndex)
        setParsedTasks(updatedStories)
    }

    // Add new Subtask to User Story
    const addNewSubtask = (storyIndex) => {
        const newSubtask = {
            title: '',
            description: '',
            assignee: 'TBD',
            category: 'other',
            priority: 'medium',
            issue_type: 'Sub-task',
            jira_labels: ['meeting-subtask'],
            due_date: ''
        }
        const updatedStories = [...parsedTasks]
        updatedStories[storyIndex] = {
            ...updatedStories[storyIndex],
            subtasks: [...(updatedStories[storyIndex].subtasks || []), newSubtask]
        }
        setParsedTasks(updatedStories)
    }

    // Add new User Story
    const addNewUserStory = () => {
        const newUserStory = {
            title: '',
            description: '',
            assignee: 'TBD',
            category: 'other',
            priority: 'medium',
            issue_type: 'User Story',
            jira_labels: ['meeting-story'],
            subtasks: [],
            due_date: ''
        }
        setParsedTasks([...parsedTasks, newUserStory])
    }

    const createJiraTasks = async () => {
        setLoading(true)
        setStep('creating')
        setError('')

        try {
            const response = await fetch(`http://localhost:5002/api/meetings/${meetingId}/create-jira-tasks`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    user_stories: parsedTasks,  // Send user_stories array
                    user_id: userId
                })
            })

            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('Meeting not found. Please ensure the meeting exists and has materials.')
                } else if (response.status === 500) {
                    throw new Error('Server error occurred while creating tasks. Please try again later.')
                } else {
                    throw new Error(`Task creation failed. Please check your connection and try again.`)
                }
            }

            const data = await response.json()

            if (data.success) {
                setCreationResults(data)
                setStep('results')
                if (onTasksCreated) {
                    onTasksCreated(data)
                }
            } else {
                setError(data.error || 'Failed to create tasks')
            }
        } catch (err) {
            setError(err.message || 'Network error occurred')
        } finally {
            setLoading(false)
        }
    }

    const getCategoryColor = (category) => {
        const colors = {
            frontend: 'primary',
            backend: 'success',
            testing: 'warning',
            documentation: 'info',
            management: 'secondary',
            other: 'light'
        }
        return colors[category] || 'light'
    }

    const getPriorityColor = (priority) => {
        const colors = {
            high: 'danger',
            medium: 'warning',
            low: 'success'
        }
        return colors[priority] || 'secondary'
    }

    const renderParsingStep = () => {
        const elapsed = analysisStartTime ? Math.floor((Date.now() - analysisStartTime) / 1000) : 0
        const currentStepData = analysisSteps.find(step => step.progress <= analysisProgress) || analysisSteps[0]

        return (
            <div className="text-center p-4">
                <div className="mb-4">
                    <div className="d-flex justify-content-center align-items-center mb-3">
                        <Spinner color="primary" className="me-3" />
                        <div>
                            <h5 className="mb-1">AI Task Analysis in Progress</h5>
                            <small className="text-muted">Processing your meeting content...</small>
                        </div>
                    </div>

                    <Progress
                        value={analysisProgress}
                        color="primary"
                        className="mb-3"
                        style={{ height: '8px' }}
                    />
                    <div className="d-flex justify-content-between small text-muted mb-3">
                        <span>0%</span>
                        <span className="fw-bold">{analysisProgress}%</span>
                        <span>100%</span>
                    </div>
                </div>

                <div className="p-3 bg-light rounded mb-3">
                    <div className="fw-bold text-primary mb-2">
                        {currentAnalysisStep || "🚀 Starting analysis..."}
                    </div>
                    {currentStepData && (
                        <small className="text-muted d-block">
                            💡 {currentStepData.tip}
                        </small>
                    )}
                </div>

                <div className="row text-center">
                    <div className="col-4">
                        <div className="small text-muted">Elapsed Time</div>
                        <div className="fw-bold">{elapsed}s</div>
                    </div>
                    <div className="col-4">
                        <div className="small text-muted">Processing</div>
                        <div className="fw-bold text-primary">Meeting Data</div>
                    </div>
                    <div className="col-4">
                        <div className="small text-muted">AI Engine</div>
                        <div className="fw-bold text-success">Gemini Pro</div>
                    </div>
                </div>

                <div className="mt-4 p-2 bg-info bg-opacity-10 rounded">
                    <small className="text-info">
                        <strong>Fun Fact:</strong> Our AI analyzes meeting patterns, identifies action items,
                        and creates structured User Stories automatically. No more manual note-taking! 🎉
                    </small>
                </div>
            </div>
        )
    }

    // Simple Markdown renderer
    const renderMarkdown = (text) => {
        if (!text) return ''

        // Replace Chinese titles and statistics in meetingSummary with English
        let replaced = text
            .replace('📋 AI任务分析结果', '📋 AI Task Analysis Result')
            .replace(/从会议内容中识别出 (\d+) 个User Story，包含 (\d+) 个Subtask。/g, 'Identified $1 User Stories and $2 Subtasks from the meeting content.')

        return replaced
            .replace(/^### (.*$)/gim, '<h6 class="fw-bold text-primary mt-3 mb-2">$1</h6>')
            .replace(/^## (.*$)/gim, '<h5 class="fw-bold text-primary mt-3 mb-2">$1</h5>')
            .replace(/^# (.*$)/gim, '<h4 class="fw-bold text-primary mt-3 mb-2">$1</h4>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/^- (.*$)/gim, '<div class="ms-3 mb-1">• $1</div>')
            .replace(/^\* (.*$)/gim, '<div class="ms-3 mb-1">• $1</div>')
            .replace(/\n/g, '<br/>')
    }

    const renderEditingStep = () => (
        <div>
            {meetingSummary && (
                <div className="mb-4 p-3 bg-light rounded border">
                    <h6 className="mb-3 text-primary">📋 Meeting Summary</h6>
                    <div
                        className="small text-dark"
                        style={{
                            maxHeight: '200px',
                            overflowY: 'auto',
                            lineHeight: '1.5'
                        }}
                        dangerouslySetInnerHTML={{
                            __html: renderMarkdown(meetingSummary)
                        }}
                    />
                </div>
            )}

            <div className="d-flex justify-content-between align-items-center mb-3">
                <h6>🏗️ Extracted User Stories ({parsedTasks.length}) & Subtasks ({parsedTasks.reduce((total, story) => total + (story.subtasks?.length || 0), 0)})</h6>
                <Button color="outline-primary" size="sm" onClick={addNewUserStory}>
                    + Add User Story
                </Button>
            </div>

            <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                {parsedTasks.map((userStory, storyIndex) => (
                    <div key={storyIndex} className="border rounded p-3 mb-4 bg-light">
                        {/* User Story Header */}
                        <div className="d-flex justify-content-between align-items-start mb-3">
                            <div className="d-flex gap-2">
                                <Badge color="primary" className="fw-bold">
                                    📖 USER STORY
                                </Badge>
                                <Badge color={getPriorityColor(userStory.priority)}>
                                    {userStory.priority}
                                </Badge>
                                <Badge color={getCategoryColor(userStory.category)}>
                                    {userStory.category}
                                </Badge>
                            </div>
                            <div className="d-flex gap-2">
                                <Button
                                    color="outline-success"
                                    size="sm"
                                    onClick={() => addNewSubtask(storyIndex)}
                                    title="Add Subtask to this User Story"
                                >
                                    + Subtask
                                </Button>
                                <Button
                                    color="outline-danger"
                                    size="sm"
                                    onClick={() => removeUserStory(storyIndex)}
                                    title="Remove this User Story"
                                >
                                    ×
                                </Button>
                            </div>
                        </div>

                        {/* User Story Fields */}
                        <FormGroup>
                            <Label className="fw-bold text-primary">User Story Title</Label>
                            <Input
                                value={userStory.title || ''}
                                onChange={(e) => updateUserStory(storyIndex, 'title', e.target.value)}
                                placeholder="Enter user story title..."
                                className="fw-bold"
                            />
                        </FormGroup>

                        <FormGroup>
                            <Label className="fw-bold text-primary">User Story Description</Label>
                            <Input
                                type="textarea"
                                rows="3"
                                value={userStory.description || ''}
                                onChange={(e) => updateUserStory(storyIndex, 'description', e.target.value)}
                                placeholder="User story description..."
                            />
                        </FormGroup>

                        <div className="row">
                            <div className="col-md-4">
                                <FormGroup>
                                    <Label className="fw-bold">Assignee</Label>
                                    <Input
                                        value={userStory.assignee || ''}
                                        onChange={(e) => updateUserStory(storyIndex, 'assignee', e.target.value)}
                                        placeholder="Enter name, email or leave 'TBD'"
                                    />
                                </FormGroup>
                            </div>
                            <div className="col-md-4">
                                <FormGroup>
                                    <Label className="fw-bold">Priority</Label>
                                    <Input
                                        type="select"
                                        value={userStory.priority || 'medium'}
                                        onChange={(e) => updateUserStory(storyIndex, 'priority', e.target.value)}
                                    >
                                        <option value="high">High</option>
                                        <option value="medium">Medium</option>
                                        <option value="low">Low</option>
                                    </Input>
                                </FormGroup>
                            </div>
                            <div className="col-md-4">
                                <FormGroup>
                                    <Label className="fw-bold">Category</Label>
                                    <Input
                                        type="select"
                                        value={userStory.category || 'other'}
                                        onChange={(e) => updateUserStory(storyIndex, 'category', e.target.value)}
                                    >
                                        <option value="frontend">Frontend</option>
                                        <option value="backend">Backend</option>
                                        <option value="testing">Testing</option>
                                        <option value="documentation">Documentation</option>
                                        <option value="integration">Integration</option>
                                        <option value="other">Other</option>
                                    </Input>
                                </FormGroup>
                            </div>
                        </div>

                        <div className="row">
                            <div className="col-md-6">
                                <FormGroup>
                                    <Label className="fw-bold">Due Date</Label>
                                    <Input
                                        type="date"
                                        lang="en"
                                        value={userStory.due_date || ''}
                                        onChange={(e) => updateUserStory(storyIndex, 'due_date', e.target.value)}
                                        placeholder="YYYY-MM-DD"
                                    />
                                </FormGroup>
                            </div>
                        </div>

                        {/* Subtasks Section */}
                        <div className="mt-4">
                            <h6 className="text-success mb-3">🔧 Subtasks ({userStory.subtasks?.length || 0})</h6>
                            {(userStory.subtasks || []).map((subtask, subtaskIndex) => (
                                <div key={subtaskIndex} className="border rounded p-3 mb-3 bg-white">
                                    <div className="d-flex justify-content-between align-items-start mb-2">
                                        <div className="d-flex gap-2">
                                            <Badge color="warning" className="fw-bold">
                                                🔧 SUBTASK
                                            </Badge>
                                            <Badge color={getCategoryColor(subtask.category)}>
                                                {subtask.category}
                                            </Badge>
                                            <Badge color={getPriorityColor(subtask.priority)}>
                                                {subtask.priority}
                                            </Badge>
                                        </div>
                                        <Button
                                            color="outline-danger"
                                            size="sm"
                                            onClick={() => removeSubtask(storyIndex, subtaskIndex)}
                                            title="Remove this Subtask"
                                        >
                                            ×
                                        </Button>
                                    </div>

                                    <FormGroup>
                                        <Label className="fw-bold text-warning">Subtask Title</Label>
                                        <Input
                                            value={subtask.title || ''}
                                            onChange={(e) => updateSubtask(storyIndex, subtaskIndex, 'title', e.target.value)}
                                            placeholder="Enter subtask title..."
                                        />
                                    </FormGroup>

                                    <FormGroup>
                                        <Label className="fw-bold">Subtask Description</Label>
                                        <Input
                                            type="textarea"
                                            rows="2"
                                            value={subtask.description || ''}
                                            onChange={(e) => updateSubtask(storyIndex, subtaskIndex, 'description', e.target.value)}
                                            placeholder="Subtask description..."
                                        />
                                    </FormGroup>

                                    <div className="row">
                                        <div className="col-md-6">
                                            <FormGroup>
                                                <Label className="fw-bold">Assignee</Label>
                                                <Input
                                                    value={subtask.assignee || ''}
                                                    onChange={(e) => updateSubtask(storyIndex, subtaskIndex, 'assignee', e.target.value)}
                                                    placeholder="Enter name, email or leave 'TBD'"
                                                />
                                            </FormGroup>
                                        </div>
                                        <div className="col-md-6">
                                            <FormGroup>
                                                <Label className="fw-bold">Category</Label>
                                                <Input
                                                    type="select"
                                                    value={subtask.category || 'other'}
                                                    onChange={(e) => updateSubtask(storyIndex, subtaskIndex, 'category', e.target.value)}
                                                >
                                                    <option value="frontend">Frontend</option>
                                                    <option value="backend">Backend</option>
                                                    <option value="testing">Testing</option>
                                                    <option value="documentation">Documentation</option>
                                                    <option value="integration">Integration</option>
                                                    <option value="other">Other</option>
                                                </Input>
                                            </FormGroup>
                                        </div>
                                    </div>

                                    <div className="row">
                                        <div className="col-md-6">
                                            <FormGroup>
                                                <Label className="fw-bold">Priority</Label>
                                                <Input
                                                    type="select"
                                                    value={subtask.priority || 'medium'}
                                                    onChange={(e) => updateSubtask(storyIndex, subtaskIndex, 'priority', e.target.value)}
                                                >
                                                    <option value="high">High</option>
                                                    <option value="medium">Medium</option>
                                                    <option value="low">Low</option>
                                                </Input>
                                            </FormGroup>
                                        </div>
                                        <div className="col-md-6">
                                            <FormGroup>
                                                <Label className="fw-bold">Due Date</Label>
                                                <Input
                                                    type="date"
                                                    lang="en"
                                                    value={subtask.due_date || ''}
                                                    onChange={(e) => updateSubtask(storyIndex, subtaskIndex, 'due_date', e.target.value)}
                                                    placeholder="YYYY-MM-DD"
                                                />
                                            </FormGroup>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {(!userStory.subtasks || userStory.subtasks.length === 0) && (
                                <div className="text-center p-3 text-muted border rounded bg-white">
                                    <p>No subtasks in this user story yet.</p>
                                    <Button color="success" size="sm" onClick={() => addNewSubtask(storyIndex)}>
                                        Add First Subtask
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {parsedTasks.length === 0 && (
                <div className="text-center p-4 text-muted">
                    <p>No user stories were detected in the meeting content.</p>
                    <Button color="primary" onClick={addNewUserStory}>
                        Add Manual User Story
                    </Button>
                </div>
            )}
        </div>
    )

    const renderResultsStep = () => (
        <div>
            <div className="text-center mb-4">
                <h5 className="text-success">✅ Smart Hierarchy Creation Complete!</h5>
                <p className="text-muted">
                    {creationResults.created_stories}/{creationResults.total_stories} User Stories created, {' '}
                    {creationResults.created_subtasks}/{creationResults.total_subtasks} Subtasks created
                    {creationResults.failed_count > 0 && `, ${creationResults.failed_count} failed`}
                </p>
            </div>

            <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                {creationResults.results.map((storyResult, storyIndex) => (
                    <div key={storyIndex} className="border rounded p-3 mb-3 bg-light">
                        {/* User Story Result */}
                        <div className={`border rounded p-2 mb-2 ${storyResult.story_success ? 'border-success bg-success bg-opacity-10' : 'border-danger bg-danger bg-opacity-10'}`}>
                            <div className="d-flex justify-content-between align-items-start">
                                <div>
                                    <h6 className="mb-1">
                                        <Badge color="primary" className="me-2">📖 USER STORY</Badge>
                                        {storyResult.story_title}
                                    </h6>
                                    {storyResult.story_success ? (
                                        <div>
                                            <Badge color="success">Created</Badge>
                                            <small className="ms-2 text-muted">
                                                Key: {storyResult.story_key}
                                            </small>
                                        </div>
                                    ) : (
                                        <div>
                                            <Badge color="danger">Failed</Badge>
                                            <small className="ms-2 text-muted">
                                                {storyResult.story_error}
                                            </small>
                                        </div>
                                    )}
                                </div>
                                {storyResult.story_success && storyResult.story_url && (
                                    <Button
                                        color="outline-primary"
                                        size="sm"
                                        onClick={() => window.open(storyResult.story_url, '_blank')}
                                    >
                                        View Story
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* Subtasks Results */}
                        {storyResult.subtasks && storyResult.subtasks.length > 0 && (
                            <div className="ms-3">
                                <small className="text-muted fw-bold">Subtasks in this User Story:</small>
                                {storyResult.subtasks.map((subtaskResult, subtaskIndex) => (
                                    <div key={subtaskIndex} className={`border rounded p-2 mt-2 ${subtaskResult.subtask_success ? 'border-warning bg-warning bg-opacity-5' : 'border-danger bg-danger bg-opacity-5'}`}>
                                        <div className="d-flex justify-content-between align-items-start">
                                            <div>
                                                <h6 className="mb-1 small">
                                                    <Badge color="warning" size="sm" className="me-2">🔧 SUBTASK</Badge>
                                                    {subtaskResult.subtask_title}
                                                </h6>
                                                {subtaskResult.subtask_success ? (
                                                    <div>
                                                        <Badge color="success" className="small">Created</Badge>
                                                        <small className="ms-2 text-muted">
                                                            Key: {subtaskResult.subtask_key}
                                                        </small>
                                                    </div>
                                                ) : (
                                                    <div>
                                                        <Badge color="danger" className="small">Failed</Badge>
                                                        <small className="ms-2 text-muted">
                                                            {subtaskResult.subtask_error}
                                                        </small>
                                                    </div>
                                                )}
                                            </div>
                                            {subtaskResult.subtask_success && subtaskResult.subtask_url && (
                                                <Button
                                                    color="outline-warning"
                                                    size="sm"
                                                    onClick={() => window.open(subtaskResult.subtask_url, '_blank')}
                                                >
                                                    View Subtask
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    )

    return (
        <Modal isOpen={isOpen} toggle={toggle} size="lg" className="task-analysis-modal">
            <ModalHeader toggle={toggle}>
                🤖 AI Task Analysis & Jira Creation
            </ModalHeader>
            <ModalBody>
                {error && (
                    <Alert color="danger" className="mb-3">
                        <strong>Error:</strong> {error}
                    </Alert>
                )}

                {step === 'parsing' && renderParsingStep()}
                {step === 'editing' && renderEditingStep()}
                {step === 'creating' && (
                    <div className="text-center p-4">
                        <Spinner color="success" />
                        <h5 className="mt-3">Creating Jira tasks...</h5>
                        <p className="text-muted">Please wait while we create your tasks in Jira.</p>
                    </div>
                )}
                {step === 'results' && renderResultsStep()}
            </ModalBody>
            <ModalFooter>
                {step === 'editing' && (
                    <>
                        <Button color="secondary" onClick={toggle}>
                            Cancel
                        </Button>
                        <Button
                            color="primary"
                            onClick={createJiraTasks}
                            disabled={loading || parsedTasks.length === 0}
                        >
                            {loading ? <Spinner size="sm" /> : 'Create User Stories & Subtasks in Jira'}
                        </Button>
                    </>
                )}
                {step === 'results' && (
                    <Button color="success" onClick={toggle}>
                        Done
                    </Button>
                )}
                {(step === 'parsing' || step === 'creating') && (
                    <Button color="secondary" onClick={toggle} disabled={loading}>
                        Cancel
                    </Button>
                )}
            </ModalFooter>
        </Modal>
    )
}

export default TaskAnalysisModal