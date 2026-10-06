import { useEffect, useState } from "react";
import api from "./services/api";
import "./App.css";

function App() {
  const [loginMode, setLoginMode] = useState(
    !localStorage.getItem("access_token")
  );
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const [dashboard, setDashboard] = useState(null);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [leaveHistory, setLeaveHistory] = useState([]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [reason, setReason] = useState("");

  const loadDashboard = async () => {
    try {
      const response = await api.get("/api/employees/dashboard");
      setDashboard(response.data);
    } catch (err) {
      if (err.response?.status === 401) {
        localStorage.removeItem("access_token");
        setLoginMode(true);
        setError("Your session has expired. Please login again.");
      } else {
        setError("Unable to load employee dashboard.");
      }
    }
  };

  const loadLeaveTypes = async () => {
    try {
      const response = await api.get("/api/leaves/balance");
      setLeaveTypes(response.data.balances || []);
    } catch (err) {
      setError("Unable to load leave types.");
    }
  };

  const loadLeaveHistory = async () => {
    try {
      const response = await api.get("/api/leaves/my");
      setLeaveHistory(response.data || []);
    } catch (err) {
      setError("Unable to load leave history.");
    }
  };

  const handleLogin = async (event) => {
    event.preventDefault();

    setError("");
    setMessage("");

    if (!username || !password) {
      setError("Please enter username and password.");
      return;
    }

    setLoginLoading(true);

    try {
      const response = await api.post("/api/auth/login", {
        username,
        password,
      });

      localStorage.setItem(
        "access_token",
        response.data.access_token
      );

      setUsername("");
      setPassword("");
      setLoginMode(false);
      setLoading(true);

      await Promise.all([
        loadDashboard(),
        loadLeaveTypes(),
        loadLeaveHistory(),
      ]);

      setLoading(false);
    } catch (err) {
      if (err.response?.data?.detail) {
        setError(err.response.data.detail);
      } else {
        setError("Unable to login. Please try again.");
      }
    } finally {
      setLoginLoading(false);
    }
  };

  useEffect(() => {
    if (loginMode) {
      setLoading(false);
      return;
    }

    const token = localStorage.getItem("access_token");

    if (!token) {
      setLoginMode(true);
      setLoading(false);
      return;
    }

    const loadData = async () => {
      await Promise.all([
        loadDashboard(),
        loadLeaveTypes(),
        loadLeaveHistory(),
      ]);

      setLoading(false);
    };

    loadData();
  }, [loginMode]);

  const handleSubmitLeave = async (event) => {
    event.preventDefault();

    setMessage("");
    setError("");

    if (!leaveTypeId || !fromDate || !toDate) {
      setError("Please complete all required fields.");
      return;
    }

    if (fromDate > toDate) {
      setError("From date cannot be after to date.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await api.post("/api/leaves/", {
        leave_type_id: Number(leaveTypeId),
        from_date: fromDate,
        to_date: toDate,
        reason: reason || null,
      });

      setMessage(
        (response.data && response.data.message ? response.data.message : "Leave request submitted successfully.") +
          " Request ID: " +
          (response.data && response.data.leave_request_id ? response.data.leave_request_id : "N/A")
      );

      setLeaveTypeId("");
      setFromDate("");
      setToDate("");
      setReason("");

      await loadDashboard();
      await loadLeaveTypes();
      await loadLeaveHistory();
    } catch (err) {
      if (err.response?.data?.detail) {
        setError(err.response.data.detail);
      } else {
        setError("Unable to submit leave request.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    setDashboard(null);
    setLeaveTypes([]);
    setLeaveHistory([]);
    setLoginMode(true);
    setError("");
    setMessage("");
  };

  if (loginMode) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-header">
            <h1>Employee Leave Management</h1>
            <p>Sign in to your employee account</p>
          </div>

          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label htmlFor="username">
                Username
              </label>

              <input
                id="username"
                type="text"
                value={username}
                onChange={(event) =>
                  setUsername(event.target.value)
                }
                placeholder="Enter username"
                autoComplete="username"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">
                Password
              </label>

              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                placeholder="Enter password"
                autoComplete="current-password"
                required
              />
            </div>

            {error && (
              <div className="form-error-message">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="login-button"
              disabled={loginLoading}
            >
              {loginLoading ? "Signing in..." : "Login"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="dashboard-page">
        <div className="loading-card">
          Loading employee dashboard...
        </div>
      </div>
    );
  }

  if (error && !dashboard) {
    return (
      <div className="dashboard-page">
        <div className="error-card">
          <h2>Unable to Load Dashboard</h2>
          <p>{error}</p>

          <button
            className="logout-button"
            onClick={handleLogout}
          >
            Return to Login
          </button>
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

        <button
          className="logout-button"
          onClick={handleLogout}
        >
          Logout
        </button>
      </header>

      <main className="dashboard-container">

        <section className="welcome-card">
          <div>
            <h2>
              Welcome,{" "}
              {employee.full_name ||
                employee.username ||
                "Employee"}
            </h2>

            <p>
              Manage your leave requests and monitor your leave
              balance.
            </p>
          </div>
        </section>

        <section className="employee-card">
          <h2>Employee Information</h2>

          <div className="employee-grid">
            <div>
              <span>Employee ID</span>
              <strong>
                {employee.employee_id ||
                  employee.id ||
                  "-"}
              </strong>
            </div>

            <div>
              <span>Name</span>
              <strong>
                {employee.full_name || "-"}
              </strong>
            </div>

            <div>
              <span>Email</span>
              <strong>
                {employee.email || "-"}
              </strong>
            </div>

            <div>
              <span>Department</span>
              <strong>
                {employee.department || "-"}
              </strong>
            </div>
          </div>
        </section>

        <section className="stats-grid">
          <div className="stat-card">
            <span>Total Requests</span>
            <strong>
              {leaveSummary.total_requests || 0}
            </strong>
          </div>

          <div className="stat-card">
            <span>Pending</span>
            <strong>
              {leaveSummary.pending || 0}
            </strong>
          </div>

          <div className="stat-card">
            <span>Approved</span>
            <strong>
              {leaveSummary.approved || 0}
            </strong>
          </div>

          <div className="stat-card">
            <span>Rejected</span>
            <strong>
              {leaveSummary.rejected || 0}
            </strong>
          </div>
        </section>

        <section className="balance-card">
          <h2>Leave Balance</h2>

          <div className="balance-grid">
            <div>
              <span>Allocated</span>
              <strong>
                {leaveSummary.allocated_days || 0}
              </strong>
            </div>

            <div>
              <span>Used</span>
              <strong>
                {leaveSummary.used_days || 0}
              </strong>
            </div>

            <div>
              <span>Reserved</span>
              <strong>
                {leaveSummary.reserved_days || 0}
              </strong>
            </div>

            <div>
              <span>Remaining</span>
              <strong>
                {leaveSummary.remaining_days || 0}
              </strong>
            </div>
          </div>
        </section>

        <section className="leave-form-card">
          <h2>Request Leave</h2>

          <form onSubmit={handleSubmitLeave}>
            <div className="form-grid">

              <div className="form-group">
                <label htmlFor="leaveType">
                  Leave Type
                </label>

                <select
                  id="leaveType"
                  value={leaveTypeId}
                  onChange={(event) =>
                    setLeaveTypeId(event.target.value)
                  }
                  required
                >
                  <option value="">
                    Select leave type
                  </option>

                  {leaveTypes.map((leaveType) => (
                    <option
                      key={leaveType.leave_type_id}
                      value={leaveType.leave_type_id}
                    >
                      {leaveType.leave_type} (
                      {leaveType.remaining_days} days
                      remaining)
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="fromDate">
                  From Date
                </label>

                <input
                  id="fromDate"
                  type="date"
                  value={fromDate}
                  onChange={(event) =>
                    setFromDate(event.target.value)
                  }
                  min={
                    new Date()
                      .toISOString()
                      .split("T")[0]
                  }
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="toDate">
                  To Date
                </label>

                <input
                  id="toDate"
                  type="date"
                  value={toDate}
                  onChange={(event) =>
                    setToDate(event.target.value)
                  }
                  min={
                    fromDate ||
                    new Date()
                      .toISOString()
                      .split("T")[0]
                  }
                  required
                />
              </div>

              <div className="form-group form-group-full">
                <label htmlFor="reason">
                  Reason
                </label>

                <textarea
                  id="reason"
                  rows="4"
                  placeholder="Enter reason for leave"
                  value={reason}
                  onChange={(event) =>
                    setReason(event.target.value)
                  }
                />
              </div>
            </div>

            <button
              type="submit"
              className="submit-leave-button"
              disabled={submitting}
            >
              {submitting
                ? "Submitting..."
                : "Submit Leave Request"}
            </button>
          </form>

          {message && (
            <div className="success-message">
              {message}
            </div>
          )}

          {error && (
            <div className="form-error-message">
              {error}
            </div>
          )}
        </section>

        <section className="history-card">
          <div className="history-header">
            <div>
              <h2>Leave History</h2>
              <p>
                View all your submitted leave requests.
              </p>
            </div>

            <span className="history-count">
              {leaveHistory.length} request
              {leaveHistory.length !== 1
                ? "s"
                : ""}
            </span>
          </div>

          {leaveHistory.length === 0 ? (
            <p className="empty-message">
              No leave history found.
            </p>
          ) : (
            <div className="history-list">
              {leaveHistory.map((leave) => {
                const from = new Date(leave.from_date);
                const to = new Date(leave.to_date);

                const totalDays =
                  Math.floor(
                    (to - from) /
                      (1000 * 60 * 60 * 24)
                  ) + 1;

                return (
                  <div
                    className="history-item"
                    key={leave.leave_request_id}
                  >
                    <div className="history-main">
                      <div>
                        <span className="history-label">
                          Request ID
                        </span>

                        <strong>
                          #{leave.leave_request_id}
                        </strong>
                      </div>

                      <span
                        className={"status status-" + leave.status}
                      >
                        {leave.status}
                      </span>
                    </div>

                    <div className="history-details">
                      <div>
                        <span>Leave Type</span>

                        <strong>
                          {leave.leave_type_id === 1
                            ? "Annual Leave"
                            : ("Leave Type " + leave.leave_type_id)}
                        </strong>
                      </div>

                      <div>
                        <span>From</span>
                        <strong>
                          {leave.from_date}
                        </strong>
                      </div>

                      <div>
                        <span>To</span>
                        <strong>
                          {leave.to_date}
                        </strong>
                      </div>

                      <div>
                        <span>Days</span>
                        <strong>
                          {totalDays}
                        </strong>
                      </div>
                    </div>

                    <div className="history-reason">
                      <span>Reason</span>

                      <p>
                        {leave.reason ||
                          "No reason provided"}
                      </p>
                    </div>

                    {leave.manager_comment && (
                      <div className="manager-comment">
                        <span>
                          Manager Comment
                        </span>

                        <p>
                          {leave.manager_comment}
                        </p>
                      </div>
                    )}

                    <div className="history-created">
                      Submitted:{" "}
                      {leave.created_at
                        ? new Date(
                            leave.created_at
                          ).toLocaleString()
                        : "-"}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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
  {recentRequests.map((request, index) => (
    <tr
      key={`recent-request-${request.leave_request_id || request.id || index}`}
    >
      <td>
        {request.id ||
          request.leave_request_id ||
          "-"}
      </td>

      <td>
        {request.leave_type || "-"}
      </td>

      <td>
        {request.start_date || "-"}
      </td>

      <td>
        {request.end_date || "-"}
      </td>

      <td>
        {request.total_days || 0}
      </td>

      <td>
        <span
          className={`status status-${
            request.status || "unknown"
          }`}
        >
          {request.status || "Unknown"}
        </span>
      </td>
    </tr>
  ))}
</tbody>            
      </table>
            </div> )}
        </section>
      </main>
    </div>
  );
}

export default App;
