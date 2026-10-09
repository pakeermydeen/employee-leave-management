import { useEffect, useState } from "react";
import api from "./services/api";
import "./App.css";

function App() {
  const [loginMode, setLoginMode] = useState(
    !localStorage.getItem("access_token")
  );

  const [user, setUser] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [leaveHistory, setLeaveHistory] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [managerLeaves, setManagerLeaves] = useState([]);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [loginLoading, setLoginLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [processingLeave, setProcessingLeave] = useState(null);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [reason, setReason] = useState("");

  const [managerComments, setManagerComments] = useState({});

  // =========================================================
  // AUTH
  // =========================================================

  const loadCurrentUser = async () => {
    try {
      const response = await api.get("/api/auth/me");
      setUser(response.data);
      return response.data;
    } catch (err) {
      if (err.response?.status === 401) {
        localStorage.removeItem("access_token");
        setLoginMode(true);
        setUser(null);
        setError("Your session has expired. Please login again.");
      } else {
        setError("Unable to load user information.");
      }

      return null;
    }
  };

  // =========================================================
  // EMPLOYEE APIs
  // =========================================================

  const loadDashboard = async () => {
    try {
      const response = await api.get("/api/employees/dashboard");
      setDashboard(response.data);
    } catch (err) {
      if (err.response?.status === 401) {
        localStorage.removeItem("access_token");
        setLoginMode(true);
        setUser(null);
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

  const loadDocuments = async () => {
    try {
      const response = await api.get("/api/documents/my");
      setDocuments(response.data || []);
    } catch (err) {
      console.log("DOCUMENT API STATUS:", err.response?.status);
      console.log("DOCUMENT API ERROR:", err.response?.data);
    }
  };

  // =========================================================
  // MANAGER APIs
  // =========================================================

  const loadManagerLeaves = async () => {
    try {
      const response = await api.get("/api/manager/leaves");

      const data = response.data;

      if (Array.isArray(data)) {
        setManagerLeaves(data);
      } else if (Array.isArray(data?.leaves)) {
        setManagerLeaves(data.leaves);
      } else if (Array.isArray(data?.pending_leaves)) {
        setManagerLeaves(data.pending_leaves);
      } else if (Array.isArray(data?.requests)) {
        setManagerLeaves(data.requests);
      } else {
        setManagerLeaves([]);
      }
    } catch (err) {
      if (err.response?.status === 401) {
        localStorage.removeItem("access_token");
        setLoginMode(true);
        setUser(null);
        setError("Your session has expired. Please login again.");
      } else {
        setError(
          err.response?.data?.detail ||
            "Unable to load manager leave requests."
        );
      }
    }
  };

  const handleManagerDecision = async (leaveId, status) => {
    setError("");
    setMessage("");
    setProcessingLeave(leaveId);

    try {
      const comment =
        managerComments[leaveId]?.trim() ||
        (status === "approved"
          ? "Leave approved."
          : "Leave rejected.");

      await api.put(`/api/manager/leaves/${leaveId}`, {
        status: status,
        manager_comment: comment,
      });

      setMessage(
        `Leave request #${leaveId} has been ${status}.`
      );

      setManagerComments((previous) => {
        const updated = { ...previous };
        delete updated[leaveId];
        return updated;
      });

      await loadManagerLeaves();
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Unable to update leave request."
      );
    } finally {
      setProcessingLeave(null);
    }
  };

  // =========================================================
  // LOAD DATA BASED ON ROLE
  // =========================================================

  const loadUserData = async (currentUser) => {
    if (!currentUser) {
      return;
    }

    const role = String(currentUser.role || "").toLowerCase();

    if (role === "manager") {
      await loadManagerLeaves();
    } else {
      await Promise.all([
        loadDashboard(),
        loadLeaveTypes(),
        loadLeaveHistory(),
        loadDocuments(),
      ]);
    }
  };

  // =========================================================
  // LOGIN
  // =========================================================

  const handleLogin = async (event) => {
    event.preventDefault();

    setError("");
    setMessage("");

    if (!username || !password) {
      setError("Please enter username and password.");
      return;
    }

    setLoginLoading(true);
    setLoading(true);

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

      const currentUser = await loadCurrentUser();

      if (currentUser) {
        await loadUserData(currentUser);
      }

      setLoading(false);
    } catch (err) {
      setLoading(false);

      if (err.response?.data?.detail) {
        setError(err.response.data.detail);
      } else {
        setError("Unable to login. Please try again.");
      }
    } finally {
      setLoginLoading(false);
    }
  };

  // =========================================================
  // INITIAL LOAD
  // =========================================================

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
      setLoading(true);

      const currentUser = await loadCurrentUser();

      if (currentUser) {
        await loadUserData(currentUser);
      }

      setLoading(false);
    };

    loadData();
  }, [loginMode]);

  // =========================================================
  // EMPLOYEE LEAVE SUBMISSION
  // =========================================================

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
        (response.data?.message ||
          "Leave request submitted successfully.") +
          " Request ID: " +
          (response.data?.leave_request_id || "N/A")
      );

      setLeaveTypeId("");
      setFromDate("");
      setToDate("");
      setReason("");

      await loadDashboard();
      await loadLeaveTypes();
      await loadLeaveHistory();
      await loadDocuments();
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

  // =========================================================
  // LOGOUT
  // =========================================================

  const handleLogout = () => {
    localStorage.removeItem("access_token");

    setUser(null);
    setDashboard(null);
    setLeaveTypes([]);
    setLeaveHistory([]);
    setDocuments([]);
    setManagerLeaves([]);

    setLoginMode(true);

    setError("");
    setMessage("");
  };

  // =========================================================
  // LOGIN SCREEN
  // =========================================================

  if (loginMode) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-header">
            <h1>Employee Leave Management</h1>
            <p>Sign in to your account</p>
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

  // =========================================================
  // LOADING
  // =========================================================

  if (loading) {
    return (
      <div className="dashboard-page">
        <div className="loading-card">
          Loading dashboard...
        </div>
      </div>
    );
  }

  // =========================================================
  // MANAGER DASHBOARD
  // =========================================================

  if (
    user &&
    String(user.role || "").toLowerCase() === "manager"
  ) {
    return (
      <div className="dashboard-page">
        <header className="dashboard-header">
          <div>
            <h1>Employee Leave Management</h1>
            <p>Manager Dashboard</p>
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
                {user.full_name ||
                  user.username ||
                  "Manager"}
              </h2>

              <p>
                Review and manage employee leave requests.
              </p>
            </div>
          </section>

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

          <section className="stats-grid">
            <div className="stat-card">
              <span>Pending Requests</span>
              <strong>
                {managerLeaves.length}
              </strong>
            </div>

            <div className="stat-card">
              <span>Manager</span>
              <strong>Yes</strong>
            </div>

            <div className="stat-card">
              <span>Username</span>
              <strong>
                {user.username || "-"}
              </strong>
            </div>

            <div className="stat-card">
              <span>Role</span>
              <strong>
                {user.role || "manager"}
              </strong>
            </div>
          </section>

          <section className="requests-card">
            <div className="history-header">
              <div>
                <h2>Pending Leave Requests</h2>
                <p>
                  Review employee requests and approve or
                  reject them.
                </p>
              </div>

              <span className="history-count">
                {managerLeaves.length} request
                {managerLeaves.length !== 1 ? "s" : ""}
              </span>
            </div>

            {managerLeaves.length === 0 ? (
              <p className="empty-message">
                No pending leave requests found.
              </p>
            ) : (
              <div className="history-list">
                {managerLeaves.map((leave, index) => {
                  const leaveId =
                    leave.leave_request_id ||
                    leave.id ||
                    leave.request_id ||
                    index;

                  const fromDate =
                    leave.from_date ||
                    leave.start_date ||
                    "-";

                  const toDate =
                    leave.to_date ||
                    leave.end_date ||
                    "-";

                  let totalDays =
                    leave.total_days ||
                    leave.days ||
                    null;

                  if (
                    !totalDays &&
                    fromDate !== "-" &&
                    toDate !== "-"
                  ) {
                    const from = new Date(fromDate);
                    const to = new Date(toDate);

                    totalDays =
                      Math.floor(
                        (to - from) /
                          (1000 * 60 * 60 * 24)
                      ) + 1;
                  }

                  const employeeName =
                    leave.employee_name ||
                    leave.full_name ||
                    leave.employee?.full_name ||
                    leave.username ||
                    `Employee ${leave.employee_id || ""}`;

                  const leaveType =
                    leave.leave_type ||
                    leave.leave_type_name ||
                    (leave.leave_type_id
                      ? `Leave Type ${leave.leave_type_id}`
                      : "-");

                  return (
                    <div
                      className="history-item"
                      key={leaveId}
                    >
                      <div className="history-main">
                        <div>
                          <span className="history-label">
                            Request ID
                          </span>

                          <strong>
                            #{leaveId}
                          </strong>
                        </div>

                        <span
                          className={
                            "status status-" +
                            (leave.status || "pending")
                          }
                        >
                          {leave.status || "pending"}
                        </span>
                      </div>

                      <div className="history-details">
                        <div>
                          <span>Employee</span>
                          <strong>
                            {employeeName}
                          </strong>
                        </div>

                        <div>
                          <span>Employee ID</span>
                          <strong>
                            {leave.employee_id || "-"}
                          </strong>
                        </div>

                        <div>
                          <span>Leave Type</span>
                          <strong>
                            {leaveType}
                          </strong>
                        </div>

                        <div>
                          <span>Days</span>
                          <strong>
                            {totalDays || 0}
                          </strong>
                        </div>

                        <div>
                          <span>From</span>
                          <strong>
                            {fromDate}
                          </strong>
                        </div>

                        <div>
                          <span>To</span>
                          <strong>
                            {toDate}
                          </strong>
                        </div>
                      </div>

                      <div className="history-reason">
                        <span>Employee Reason</span>

                        <p>
                          {leave.reason ||
                            "No reason provided"}
                        </p>
                      </div>

                      <div className="form-group">
                        <label
                          htmlFor={`comment-${leaveId}`}
                        >
                          Manager Comment
                        </label>

                        <textarea
                          id={`comment-${leaveId}`}
                          rows="3"
                          placeholder="Enter approval or rejection comment"
                          value={
                            managerComments[leaveId] || ""
                          }
                          onChange={(event) =>
                            setManagerComments(
                              (previous) => ({
                                ...previous,
                                [leaveId]:
                                  event.target.value,
                              })
                            )
                          }
                        />
                      </div>

                      <div
                        style={{
                          display: "flex",
                          gap: "12px",
                          marginTop: "15px",
                          flexWrap: "wrap",
                        }}
                      >
                        <button
                          type="button"
                          className="submit-leave-button"
                          disabled={
                            processingLeave === leaveId
                          }
                          onClick={() =>
                            handleManagerDecision(
                              leaveId,
                              "approved"
                            )
                          }
                        >
                          {processingLeave === leaveId
                            ? "Processing..."
                            : "Approve Leave"}
                        </button>

                        <button
                          type="button"
                          className="logout-button"
                          disabled={
                            processingLeave === leaveId
                          }
                          onClick={() =>
                            handleManagerDecision(
                              leaveId,
                              "rejected"
                            )
                          }
                        >
                          {processingLeave === leaveId
                            ? "Processing..."
                            : "Reject Leave"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </main>
      </div>
    );
  }

  // =========================================================
  // EMPLOYEE DASHBOARD
  // =========================================================

  const employee = dashboard?.employee || {};
  const leaveSummary =
    dashboard?.leave_summary || {};
  const recentRequests =
    dashboard?.recent_requests || [];

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
                user?.username ||
                "Employee"}
            </h2>

            <p>
              Manage your leave requests and monitor your
              leave balance.
            </p>
          </div>
        </section>

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
                const from = new Date(
                  leave.from_date
                );
                const to = new Date(
                  leave.to_date
                );

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
                        className={
                          "status status-" +
                          leave.status
                        }
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
                            : `Leave Type ${leave.leave_type_id}`}
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
                  {recentRequests.map(
                    (request, index) => (
                      <tr
                        key={`recent-request-${
                          request.leave_request_id ||
                          request.id ||
                          index
                        }`}
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
                              request.status ||
                              "unknown"
                            }`}
                          >
                            {request.status ||
                              "Unknown"}
                          </span>
                        </td>
                      </tr>
                    )
                  )}
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
