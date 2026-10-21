import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const SiteSelection = () => {
  const [sites, setSites] = useState([]);
  const [selectedSite, setSelectedSite] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchAvailableSites = async () => {
      try {
        const response = await fetch('http://localhost:5002/api/oauth/jira/available-sites', {
          method: 'GET',
          credentials: 'include',
          mode: 'cors',
          cache: 'no-cache'
        });

        const data = await response.json();

        if (!response.ok) {
          if (response.status === 404) {
            setError('No site selection data found. Please restart the OAuth process.');
          } else {
            setError('Failed to fetch available sites.');
          }
          setLoading(false);
          return;
        }

        if (data.success) {
          setSites(data.sites);
        } else {
          setError(data.error || 'Failed to load available sites');
        }
      } catch (err) {
        setError('Network error occurred while fetching sites.');
      }
      setLoading(false);
    };

    fetchAvailableSites();
  }, []);

  const handleSubmit = async () => {
    if (!selectedSite) {
      setError('Please select a Jira site to continue.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const response = await fetch('http://localhost:5002/api/oauth/jira/complete-site-selection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include session cookies
        mode: 'cors',
        cache: 'no-cache',
        body: JSON.stringify({
          site_id: selectedSite
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to complete site selection');
        setSubmitting(false);
        return;
      }

      const data = await response.json();
      if (data.success) {
        // Redirect to project selection page
        navigate('/jira');
      } else {
        setError(data.error || 'Failed to complete site selection');
      }
    } catch (err) {
      setError('Network error occurred during site selection.');
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="container mt-5">
        <div className="row justify-content-center">
          <div className="col-md-6">
            <div className="card shadow">
              <div className="card-body text-center">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
                <p className="mt-3">Loading available Jira sites...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mt-5">
      <div className="row justify-content-center">
        <div className="col-md-6">
          <div className="card shadow">
            <div className="card-body">
              <h4 className="card-title mb-4 text-center">Select Your Jira Site</h4>
              
              <div className="mb-4">
                <p className="text-muted text-center">
                  Multiple Jira sites are available to you. Please select the one you want to connect to:
                </p>
              </div>

              {error && (
                <div className="alert alert-danger" role="alert">
                  {error}
                </div>
              )}

              <div className="mb-4">
                <label className="form-label">Available Jira Sites:</label>
                <div className="list-group">
                  {sites.map(site => (
                    <label 
                      key={site.id} 
                      className={`list-group-item list-group-item-action ${selectedSite === site.id ? 'active' : ''}`}
                      style={{ cursor: 'pointer' }}
                    >
                      <input
                        type="radio"
                        name="site"
                        value={site.id}
                        checked={selectedSite === site.id}
                        onChange={(e) => setSelectedSite(e.target.value)}
                        className="form-check-input me-3"
                      />
                      <div>
                        <h6 className="mb-1">{site.name}</h6>
                        <small className="text-muted">{site.url}</small>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="d-grid gap-2">
                <button 
                  className="btn btn-primary btn-lg" 
                  onClick={handleSubmit}
                  disabled={submitting || !selectedSite}
                >
                  {submitting ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                      Connecting...
                    </>
                  ) : (
                    'Connect to Selected Site'
                  )}
                </button>
                
                <button 
                  className="btn btn-secondary" 
                  onClick={() => navigate('/login')}
                  disabled={submitting}
                >
                  Cancel & Return to Login
                </button>
              </div>

              <div className="mt-4 text-center">
                <small className="text-muted">
                  Your selection will determine which Jira site this application connects to for project and issue management.
                </small>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SiteSelection;