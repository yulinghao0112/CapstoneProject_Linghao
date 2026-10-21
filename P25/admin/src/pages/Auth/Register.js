import React, { useEffect, useState } from 'react';
import { connect, useDispatch, useSelector } from 'react-redux';
import { Link, Navigate } from 'react-router-dom';
import withRouter from "../../components/withRouter";

import { useFormik } from 'formik';
import * as Yup from 'yup';
import { Container, Row, Col, Card, CardBody, FormGroup, Alert, Form, Input, Button, FormFeedback, Label, InputGroup } from 'reactstrap';
import AlertModal from '../../components/AlertModal';
import { useNavigate } from 'react-router-dom';

//Import action
import { registerUser, apiError } from '../../redux/actions';

//i18n
import { useTranslation } from 'react-i18next';

//Import Images
import logodark from "../../assets/images/logo-dark.png";
import logolight from "../../assets/images/logo-light.png";
import logo from "../../assets/images/Logo.png";
import { createSelector } from 'reselect';

import axios from 'axios';

/**
 * Register component
 * @param {*} props 
 */
const Register = (props) => {
    const [modalOpen, setModalOpen] = useState(false);
    const [modalTitle, setModalTitle] = useState('');
    const [modalMessage, setModalMessage] = useState('');
    const [onModalConfirm, setOnModalConfirm] = useState(() => () => {});
    const navigate = useNavigate();

    // const navigate = useNavigate();
    const dispatch = useDispatch();
    /* intilize t variable for multi language implementation */
    const { t } = useTranslation();

    // validation
    const formik = useFormik({

        enableReinitialize: true,

        initialValues: {
            username: '',
            email: '',
            password: '',
            confirmPassword: ''
        },
        validationSchema: Yup.object({
            username: Yup.string().required('Required'),
            email: Yup.string().email('Enter proper email').required('Required'),
            password: Yup.string()
                .required('Required'),
            confirmPassword: Yup.string()
                .oneOf([Yup.ref('password'), null], 'Passwords must match')
                .required('Required')

        }),

        onSubmit: async (values) => {
            try {
                const BASE_URL = "http://localhost:5002/api";

                const res = await fetch(`${BASE_URL}/register`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(values)
                });

                if (res.ok) {
                    // auto login
                    const loginRes = await fetch(`${BASE_URL}/login`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(values)
                    });

                    if (!loginRes.ok) throw new Error("Login Failure after registration");

                    setModalTitle("Success");
                    setModalMessage("✅Register successfully! Redirecting to login...");
                    setOnModalConfirm(() => () => navigate("/login"));
                    setModalOpen(true);
                } else {
                    const text = await res.text();
                    setModalTitle("Registration Failed");
                    setModalMessage(`❌ ${text}`);
                    setOnModalConfirm(() => () => {});
                    setModalOpen(true);
                }
            } catch (err) {
                console.error("❌ Network error", err);
                setModalTitle("Error");
                setModalMessage("Registration failure: server not responding or network error");
                setOnModalConfirm(() => () => {});
                setModalOpen(true);
            }
        }
    });

    document.title = "Register"


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


            <div className="account-pages my-3 pt-sm-3">
                <Container>
                    <Row className="justify-content-center">
                        <Col md={8} lg={6} xl={5}>
                            <div className="text-center mb-4">
                                <Link to="/" className="auth-logo mb-1 d-block">
                                    <img src={logo} alt="" height="150" className="logo logo-dark" />
                                    <img src={logo} alt="" height="150" className="logo logo-light" />
                                    {/* <img src={logodark} alt="" height="30" className="logo logo-dark" /> */}
                                    {/* <img src={logolight} alt="" height="30" className="logo logo-light" /> */}
                                </Link>

                                <h4>{t('Register')}</h4>
                                <p className="text-muted mb-4">{t('Get your account now')}.</p>
                            </div>

                            <Card>
                                <CardBody className="p-4">
                                    <Form
                                        onSubmit={(e) => {
                                            e.preventDefault();
                                            formik.handleSubmit();
                                            // return false;
                                        }}
                                    >
                                        
                                        <div className="mb-3">
                                            <Label className="form-label">{t('Username')}</Label>
                                            <InputGroup className="mb-3 bg-soft-light input-group-lg rounded-lg">
                                                <span className="input-group-text border-light text-muted">
                                                    <i className="ri-user-2-line"></i>
                                                </span>
                                                <Input
                                                    type="text"
                                                    id="username"
                                                    name="username"
                                                    className="form-control form-control-lg bg-soft-light border-light"
                                                    placeholder="Enter Username"
                                                    onChange={formik.handleChange}
                                                    onBlur={formik.handleBlur}
                                                    value={formik.values.username}
                                                    invalid={formik.touched.username && formik.errors.username ? true : false}
                                                />
                                                {formik.touched.username && formik.errors.username ? (
                                                    <FormFeedback type="invalid">{formik.errors.username}</FormFeedback>
                                                ) : null}
                                            </InputGroup>
                                        </div>
                                        <div className="mb-3">
                                            <Label className="form-label">{t('Email')}</Label>
                                            <InputGroup className="input-group bg-soft-light rounded-3 mb-3">
                                                <span className="input-group-text text-muted">
                                                    <i className="ri-mail-line"></i>
                                                </span>
                                                <Input
                                                    type="text"
                                                    id="email"
                                                    name="email"
                                                    className="form-control form-control-lg bg-soft-light border-light"
                                                    placeholder="Enter Email"
                                                    onChange={formik.handleChange}
                                                    onBlur={formik.handleBlur}
                                                    value={formik.values.email}
                                                    invalid={formik.touched.email && formik.errors.email ? true : false}
                                                />
                                                {formik.touched.email && formik.errors.email ? (
                                                    <FormFeedback type="invalid">{formik.errors.email}</FormFeedback>
                                                ) : null}
                                            </InputGroup>
                                        </div>

                                        <FormGroup className="mb-4">
                                            <Label className="form-label">{t('Password')}</Label>
                                            <InputGroup className="mb-3 bg-soft-light input-group-lg rounded-lg">
                                                <span className="input-group-text border-light text-muted">
                                                    <i className="ri-lock-2-line"></i>
                                                </span>
                                                <Input
                                                    type="password"
                                                    id="password"
                                                    name="password"
                                                    className="form-control form-control-lg bg-soft-light border-light"
                                                    placeholder="Enter Password"
                                                    onChange={formik.handleChange}
                                                    onBlur={formik.handleBlur}
                                                    value={formik.values.password}
                                                    invalid={formik.touched.password && formik.errors.password ? true : false}
                                                />
                                                {formik.touched.password && formik.errors.password ? (
                                                    <FormFeedback type="invalid">{formik.errors.password}</FormFeedback>
                                                ) : null}

                                            </InputGroup>
                                        </FormGroup>

                                        <FormGroup className="mb-4">
                                            <Label className="form-label">{t('Confirm Password')}</Label>
                                            <InputGroup className="mb-3 bg-soft-light input-group-lg rounded-lg">
                                                <span className="input-group-text border-light text-muted">
                                                    <i className="ri-lock-2-line"></i>
                                                </span>
                                                <Input
                                                    type="password"
                                                    id="confirmPassword"
                                                    name="confirmPassword"
                                                    className="form-control form-control-lg bg-soft-light border-light"
                                                    placeholder="Confirm Password"
                                                    onChange={formik.handleChange}
                                                    onBlur={formik.handleBlur}
                                                    value={formik.values.confirmPassword}
                                                    invalid={formik.touched.confirmPassword && formik.errors.confirmPassword ? true : false}
                                                />
                                                {formik.touched.confirmPassword && formik.errors.confirmPassword ? (
                                                    <FormFeedback type="invalid">{formik.errors.confirmPassword}</FormFeedback>
                                                ) : null}
                                            </InputGroup>
                                        </FormGroup>


                                        <div className="d-grid">
                                            <Button color="primary" block className=" waves-effect waves-light" type="submit">
                                                Register</Button>
                                        </div>

                                    </Form>
                                </CardBody>
                            </Card>

                            <div className="mt-5 text-center">
                                <p>{t('Already have an account')} ? <Link to="login" className="font-weight-medium text-primary"> {t('Signin')} </Link> </p>
                            </div>
                        </Col>
                    </Row>
                </Container>
            </div>
        </React.Fragment>
    )
}


export default Register;