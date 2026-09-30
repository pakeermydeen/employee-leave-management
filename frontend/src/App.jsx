import { useEffect, useState } from "react";
import api from "./services/api";
import "./App.css";

function App() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = async () => {
    try {
      const response = await api.get("/api/employees/dashboard");
      setDashboard(response.data);
    } catch (err) {
      if (err.response?.status === 401) {
        localStorage.removeItem("access_token");
        setError("Your session has expired. Please login again.");
      } else {
        setError("Unable to load employee dashboard.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("access_token");

    if (!token) {
      setError("Please login first.");
      setLoading(false);
      return;
    }

    loadDashboard();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    window.location.reload();
  };

  if (loading) {
    return (
      <div className="dashboard-page">
        <div className="loading-card">
          Loading employee dashboard...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-page">
        <div className="error-card">
          <h2>Unable to Load Dashboard</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  const employee = dashboard?.employee || {};
  const leaveSummary = dashboard?.leave_summary || {};
  const recentRequests = dashboard?.recent_requests || [];

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <h1>Employee Leave Management</h1>
          <p>Employee Dashboard</p>
        </div>

        <button className="logout-button" onClick={handleLogout}>
          Logout
        </button>
      </header>

      <main className="dashboard-container">
        <section className="welcome-card">
          <div>
            <h2>
              Welcome, {employee.full_name || employee.username || "Employee"}
            </h2>
            <p>
              Manage your leave requests and monitor your leave balance.
            </p>
          </div>
        </section>

        <section className="employee-card">
          <h2>Employee Information</h2>

          <div className="employee-grid">
            <div>
              <span>Employee ID</span>
              <strong>{employee.employee_id || employee.id || "-"}</strong>
            </div>

            <div>
              <span>Name</span>
              <strong>{employee.full_name || "-"}</strong>
            </div>

            <div>
              <span>Email</span>
              <strong>{employee.email || "-"}</strong>
            </div>

            <div>
              <span>Department</span>
              <strong>{employee.department || "-"}</strong>
            </div>
          </div>
        </section>

        <section className="stats-grid">
          <div className="stat-card">
            <span>Total Requests</span>
            <strong>{leaveSummary.total_requests || 0}</strong>
          </div>

          <div className="stat-card">
            <span>Pending</span>
            <strong>{leaveSummary.pending || 0}</strong>
          </div>

          <div className="stat-card">
            <span>Approved</span>
            <strong>{leaveSummary.approved || 0}</strong>
          </div>

          <div className="stat-card">
            <span>Rejected</span>
            <strong>{leaveSummary.rejected || 0}</strong>
          </div>
        </section>

        <section className="balance-card">
          <h2>Leave Balance</h2>

          <div className="balance-grid">
            <div>
              <span>Allocated</span>
              <strong>{leaveSummary.allocated_days || 0}</strong>
            </div>

            <div>
              <span>Used</span>
              <strong>{leaveSummary.used_days || 0}</strong>
            </div>

            <div>
              <span>Reserved</span>
              <strong>{leaveSummary.reserved_days || 0}</strong>
            </div>

            <div>
              <span>Remaining</span>
              <strong>{leaveSummary.remaining_days || 0}</strong>
            </div>
          </div>
        </section>

        <section className="requests-card">
          <h2>Recent Leave Requests</h2>

          {recentRequests.length === 0 ? (
            <p className="empty-message">
              No recent leave requests found.
            </p>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Leave Type</th>
                    <th>Start Date</th>
                    <th>End Date</th>
                    <th>Days</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {recentRequests.map((request) => (
                    <tr key={request.id}>
                      <td>{request.id}</td>
                      <td>{request.leave_type || "-"}</td>
                      <td>{request.start_date || "-"}</td>
                      <td>{request.end_date || "-"}</td>
                      <td>{request.total_days || 0}</td>
                      <td>
                        <span
                          className={`status status-${request.status || "unknown"}`}
                        >
                          {request.status || "Unknown"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
