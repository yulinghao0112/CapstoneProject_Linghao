import React, { useCallback, useEffect } from 'react';
import { Container, Row, Col, Card, CardBody, FormGroup, Alert, Form, Input, Button, FormFeedback, Label, InputGroup } from 'reactstrap';
import { connect, useDispatch } from 'react-redux';
import { Spinner } from 'reactstrap';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import AlertModal from '../../components/AlertModal';
import { useFormik } from 'formik';
import { useState } from 'react';
import * as Yup from 'yup';

//i18n
import { useTranslation } from 'react-i18next';

//redux store
import { loginUser, apiError } from '../../redux/actions';

//Import Images
import logo from '../../assets/images/Logo.png';

/**
 * Login component
 * @param {*} props 
 */
const Login = (props) => {
    const [checkedAuthStatus, setCheckedAuthStatus] = useState(false);
    const [shouldRedirect, setShouldRedirect] = useState(false);
    const [isLoginDone, setIsLoginDone] = useState(false);


    const [loading, setLoading] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [modalTitle, setModalTitle] = useState('');
    const [modalMessage, setModalMessage] = useState('');
    const [pendingData, setPendingData] = useState(null);
    const handleLogin = () => {
        setModalOpen(true);
    };
    const navigate = useNavigate();
    const dispatch = useDispatch();
    /* intilize t variable for multi language implementation */
    const { t } = useTranslation();

    const clearError = useCallback(() => {
       dispatch(apiError(""));
    },[dispatch])

    useEffect(() => {
        if (shouldRedirect) {
            navigate("/dashboard");
        }
    }, [shouldRedirect, navigate]);

    useEffect(() => {
        clearError();
    }, [clearError])

    // validation
    const formik = useFormik({
        initialValues: {
            email: '',
            password: ''
        },
        validationSchema: Yup.object({
            email: Yup.string().required('Please Enter Your Email'),
            password: Yup.string().required('Please Enter Your Password')
        }),

        onSubmit: async (values) => {
            setLoading(true);
            try {
              const BASE_URL = "http://localhost:5002/api";
              const res = await fetch(`${BASE_URL}/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(values),
              });
          
              if (!res.ok) {
                const text = await res.text();
                setModalTitle("Login Failed");
                setModalMessage(`❌ Login Failed: ${text}`);
                setModalOpen(true);
                setLoading(false);
                return;
              }
          
              const data = await res.json();
              const { access_token, user_id, username } = data;
          
              localStorage.setItem("access_token", access_token);
              localStorage.setItem("authUser", JSON.stringify({
                email: values.email,
                user_id,
                username,
              }));

              const statusRes = await fetch(`${BASE_URL}/oauth/jira/status`, {
                method: "GET",
                headers: {
                  Authorization: `Bearer ${access_token}`,
                },
              });
          
              if (statusRes.ok) {
                const statusData = await statusRes.json();
                const isConnected = statusData.connected && statusData.token_valid;
                if (isConnected) {
                    setShouldRedirect(true);
                    setIsLoginDone(true);
                    // navigate("/dashboard");
                  } else {
                    const authRes = await fetch(`${BASE_URL}/oauth/jira/authorize`, {
                      method: "POST",
                      headers: {
                        Authorization: `Bearer ${access_token}`,
                      },
                    });
                  
                    if (authRes.ok) {
                      const authData = await authRes.json();
                      window.location.href = authData.authorization_url;
                      return;
                    } else {
                      const errorText = await authRes.text();
                      console.error("❌ Jira fail to authorize:", errorText);
                      setModalTitle("Jira Authorization Failed");
                      setModalMessage("Could not start Jira authorization.");
                      setModalOpen(true);
                      return;
                    }
                  }
                  
              } else {
                const errorText = await statusRes.text();
                console.error("❌ Unable to check binding status:", errorText);
                setModalTitle("Status Check Failed");
                setModalMessage("Failed to check Jira authorization status.");
                setModalOpen(true);
              }
          
            } catch (error) {
              console.error("❌ Network error:", error);
              setModalTitle("Network Error");
              setModalMessage("Login failure: server not responding or network error");
              setModalOpen(true);
            } finally {
              setLoading(false);
            }
          }
          

            });

    if (shouldRedirect && isLoginDone) {
        return <Navigate to="/dashboard" />;
      }

    return (
        <React.Fragment>
        <AlertModal
            isOpen={modalOpen}
            toggle={() => setModalOpen(!modalOpen)}
            title={modalTitle}
            message={modalMessage}
            onConfirm={async () => {
                setModalOpen(false);     
                setLoading(false);       
                setPendingData(null);    
                if (pendingData) {
                const { access_token, user_id, username } = pendingData.data;
                setLoading(false);

                localStorage.setItem("access_token", access_token);
                localStorage.setItem("authUser", JSON.stringify({
                    email: pendingData.email,
                    user_id,
                    username,
                }));

                try {
                    const authRes = await fetch("http://localhost:5002/api/oauth/jira/authorize", {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${access_token}`,
                    },
                    });

                    if (authRes.ok) {
                    const authData = await authRes.json();
                    console.log("✅ Jira Auth URL:", authData.authorization_url);

                    setTimeout(() => {
                        setModalOpen(false);
                    }, 3000);

                    window.location.href = authData.authorization_url;
                    } else {
                    const errorText = await authRes.text();
                    console.error("❌ Jira authorization failed:", errorText);
                    setModalTitle("Jira Authorization Failed");
                    setModalMessage("Could not start Jira authorization.");
                    setModalOpen(true);
                    }
                } catch (error) {
                    console.error("❌ Authorization request error:", error);
                    setModalTitle("Network Error");
                    setModalMessage("Failed to start Jira authorization due to network issues.");
                    setModalOpen(true);
                }
                }
            }}
            />


            <div className="account-pages my-5 pt-sm-1">
                <Container>
                    <Row className="justify-content-center">
                        <Col md={8} lg={6} xl={5} >
                            <div className="text-center mb-2">
                                <Link to="/" className="auth-logo mb-1 d-block">
                                    <img src={logo} alt="" height="150" className="logo logo-dark" />
                                    <img src={logo} alt="" height="150" className="logo logo-light" />
                                </Link>

                                <h4>{t('Sign in')}</h4>
                                <p className="text-muted mb-4">{t('Sign in to continue')}.</p>

                            </div>

                            <Card>
                                <CardBody className="p-4">
                                    {
                                        props.error && <Alert color="danger">{props.error}</Alert>
                                    }
                                    <div className="p-3">

                                    
                                        <Form onSubmit={formik.handleSubmit}>

                                            <div className="mb-3">
                                                <Label className="form-label">{t('Email')}</Label>
                                                <InputGroup className="mb-3 bg-soft-light rounded-3">
                                                    <span className="input-group-text text-muted" id="basic-addon3">
                                                        <i className="ri-user-2-line"></i>
                                                    </span>
                                                    <Input
                                                        type="text"
                                                        id="email"
                                                        name="email"
                                                        className="form-control form-control-lg border-light bg-soft-light"
                                                        placeholder="Enter email"
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
                                                <div className="float-end">
                                                    <Link to="/forget-password" className="text-muted font-size-13">{t('Forgot password')}?</Link>
                                                </div>
                                                <Label className="form-label">{t('Password')}</Label>
                                                <InputGroup className="mb-3 bg-soft-light rounded-3">
                                                    <span className="input-group-text text-muted">
                                                        <i className="ri-lock-2-line"></i>
                                                    </span>
                                                    <Input
                                                        type="password"
                                                        id="password"
                                                        name="password"
                                                        className="form-control form-control-lg border-light bg-soft-light"
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

                                            <div className="form-check mb-4">
                                                <Input type="checkbox" className="form-check-input" id="remember-check" />
                                                <Label className="form-check-label" htmlFor="remember-check">{t('Remember me')}</Label>
                                            </div>

                                            <div className="d-grid">
                                                <Button
                                                    color="primary"
                                                    block
                                                    className="waves-effect waves-light"
                                                    type="submit"
                                                    disabled={loading}
                                                    >
                                                    {loading ? (
                                                        <>
                                                        <Spinner size="sm" color="light" /> {t('Signing in')}...
                                                        </>
                                                    ) : (
                                                        t('Sign in')
                                                    )}
                                                </Button>

                                            </div>

                                        </Form>
                                    </div>
                                </CardBody>
                            </Card>

                            <div className="mt-5 text-center">
                                <p>{t("Don't have an account")} ? <Link to="/register" className="font-weight-medium text-primary"> {t('Signup now')} </Link> </p>                            </div>
                        </Col>
                    </Row>
                </Container>
            </div>
        </React.Fragment>
    )
}


const mapStateToProps = (state) => {
    const { user, loading, error } = state.Auth;
    return { user, loading, error };
};

export default Login;