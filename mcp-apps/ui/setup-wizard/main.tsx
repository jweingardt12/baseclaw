import { render } from "preact";
import { useState, useEffect, useCallback } from "preact/hooks";
import "./setup-wizard.css";

interface SetupStatus {
  yahoo_oauth: boolean;
  league_selected: boolean;
  password_set: boolean;
  browser_login: boolean;
}

interface League {
  league_key: string;
  name: string;
  season: string;
  num_teams: number;
}

interface Team {
  team_key: string;
  name: string;
  manager: string;
  is_owned_by_current_login: boolean;
}

type Step = "yahoo" | "league" | "password" | "complete";

function getStepIndex(step: Step): number {
  var steps: Step[] = ["yahoo", "league", "password", "complete"];
  return steps.indexOf(step);
}

function SetupWizard() {
  var [status, setStatus] = useState<SetupStatus | null>(null);
  var [currentStep, setCurrentStep] = useState<Step>("yahoo");
  var [loading, setLoading] = useState(true);
  var [error, setError] = useState("");

  // Yahoo credentials state
  var [consumerKey, setConsumerKey] = useState("");
  var [consumerSecret, setConsumerSecret] = useState("");
  var [submittingCreds, setSubmittingCreds] = useState(false);

  // League selection state
  var [leagues, setLeagues] = useState<League[]>([]);
  var [teams, setTeams] = useState<Team[]>([]);
  var [selectedLeague, setSelectedLeague] = useState("");
  var [selectedTeam, setSelectedTeam] = useState("");
  var [loadingLeagues, setLoadingLeagues] = useState(false);
  var [loadingTeams, setLoadingTeams] = useState(false);
  var [savingLeague, setSavingLeague] = useState(false);

  // Password state
  var [password, setPassword] = useState("");
  var [savingPassword, setSavingPassword] = useState(false);

  // Completion state
  var [completing, setCompleting] = useState(false);
  var [serverUrl, setServerUrl] = useState("");

  var fetchStatus = useCallback(function () {
    fetch("/setup/status")
      .then(function (r) { return r.json(); })
      .then(function (data: SetupStatus) {
        setStatus(data);
        // Determine which step to show based on completion state
        if (!data.yahoo_oauth) {
          setCurrentStep("yahoo");
        } else if (!data.league_selected) {
          setCurrentStep("league");
        } else if (!data.password_set) {
          setCurrentStep("password");
        } else {
          setCurrentStep("complete");
        }
        setLoading(false);
      })
      .catch(function (e) {
        setError("Failed to load setup status: " + e.message);
        setLoading(false);
      });
  }, []);

  useEffect(function () {
    fetchStatus();
    // Check URL params for step override (after OAuth redirect)
    var params = new URLSearchParams(window.location.search);
    var stepParam = params.get("step");
    if (stepParam === "league") {
      setCurrentStep("league");
    }
  }, []);

  // Load leagues when we reach the league step
  useEffect(function () {
    if (currentStep === "league" && leagues.length === 0 && status && status.yahoo_oauth) {
      setLoadingLeagues(true);
      fetch("/setup/leagues")
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data.error) {
            setError(data.error);
          } else {
            setLeagues(data.leagues || []);
          }
          setLoadingLeagues(false);
        })
        .catch(function (e) {
          setError("Failed to load leagues: " + e.message);
          setLoadingLeagues(false);
        });
    }
  }, [currentStep, status]);

  function handleSubmitCredentials(e: Event) {
    e.preventDefault();
    setError("");
    setSubmittingCreds(true);

    fetch("/setup/credentials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ consumer_key: consumerKey, consumer_secret: consumerSecret }),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.error) {
          setError(data.error);
          setSubmittingCreds(false);
        } else {
          // Redirect to Yahoo for authorization
          window.location.href = data.auth_url;
        }
      })
      .catch(function (e) {
        setError("Failed to save credentials: " + e.message);
        setSubmittingCreds(false);
      });
  }

  function handleSelectLeague(leagueKey: string) {
    setSelectedLeague(leagueKey);
    setSelectedTeam("");
    setTeams([]);
    setLoadingTeams(true);

    fetch("/setup/teams/" + encodeURIComponent(leagueKey))
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.error) {
          setError(data.error);
        } else {
          setTeams(data.teams || []);
          // Auto-select user's team if found
          var userTeam = (data.teams || []).find(function (t: Team) { return t.is_owned_by_current_login; });
          if (userTeam) setSelectedTeam(userTeam.team_key);
        }
        setLoadingTeams(false);
      })
      .catch(function (e) {
        setError("Failed to load teams: " + e.message);
        setLoadingTeams(false);
      });
  }

  function handleSaveLeague() {
    if (!selectedLeague || !selectedTeam) return;
    setError("");
    setSavingLeague(true);

    fetch("/setup/league", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ league_id: selectedLeague, team_id: selectedTeam }),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        setSavingLeague(false);
        if (data.error) {
          setError(data.error);
        } else {
          setCurrentStep("password");
        }
      })
      .catch(function (e) {
        setError("Failed to save league: " + e.message);
        setSavingLeague(false);
      });
  }

  function handleGeneratePassword() {
    fetch("/setup/generate-password")
      .then(function (r) { return r.json(); })
      .then(function (data) { setPassword(data.password || ""); })
      .catch(function () {});
  }

  function handleSavePassword(e: Event) {
    e.preventDefault();
    if (!password || password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setError("");
    setSavingPassword(true);

    fetch("/setup/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: password }),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        setSavingPassword(false);
        if (data.error) {
          setError(data.error);
        } else {
          setCurrentStep("complete");
        }
      })
      .catch(function (e) {
        setError("Failed to save password: " + e.message);
        setSavingPassword(false);
      });
  }

  function handleComplete() {
    setCompleting(true);
    setError("");

    fetch("/setup/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.error) {
          setError(data.error);
          setCompleting(false);
        } else {
          setServerUrl(data.mcp_url || "");
        }
      })
      .catch(function (e) {
        setError("Failed to complete setup: " + e.message);
        setCompleting(false);
      });
  }

  if (loading) {
    return (
      <div class="wizard-container">
        <div class="wizard-card">
          <div class="wizard-loading">
            <div class="spinner" />
            <p>Loading setup...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div class="wizard-container">
      <div class="wizard-card">
        <div class="wizard-header">
          <div class="wizard-logo">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="#1e293b" />
              <path d="M8 16L14 10L20 16L14 22Z" fill="#3b82f6" opacity="0.6" />
              <path d="M12 16L18 10L24 16L18 22Z" fill="#3b82f6" />
            </svg>
          </div>
          <h1>BaseClaw Setup</h1>
          <p class="wizard-subtitle">Configure your Yahoo Fantasy Baseball MCP server</p>
        </div>

        <div class="progress-bar">
          <div class="progress-steps">
            {(["yahoo", "league", "password", "complete"] as Step[]).map(function (step, i) {
              var isActive = step === currentStep;
              var isDone = getStepIndex(currentStep) > i;
              var labels = ["Yahoo API", "League", "Password", "Done"];
              return (
                <div key={step} class={"progress-step" + (isActive ? " active" : "") + (isDone ? " done" : "")}>
                  <div class="step-dot">
                    {isDone ? (
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M3 7L6 10L11 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                      </svg>
                    ) : (
                      <span>{i + 1}</span>
                    )}
                  </div>
                  <span class="step-label">{labels[i]}</span>
                </div>
              );
            })}
          </div>
          <div class="progress-track">
            <div class="progress-fill" style={{ width: (getStepIndex(currentStep) / 3 * 100) + "%" }} />
          </div>
        </div>

        {error && (
          <div class="wizard-error">
            <span>{error}</span>
            <button class="error-dismiss" onClick={function () { setError(""); }}>Dismiss</button>
          </div>
        )}

        <div class="wizard-body">
          {currentStep === "yahoo" && (
            <div class="step-content">
              <h2>Connect Yahoo Developer App</h2>
              <div class="instructions">
                <p>Create a Yahoo Developer app to connect BaseClaw to your fantasy league.</p>
                <ol>
                  <li>Go to <a href="https://developer.yahoo.com/apps/create/" target="_blank" rel="noopener">developer.yahoo.com/apps</a> and create a new app</li>
                  <li>Set <strong>Application Type</strong> to "Installed Application"</li>
                  <li>Set <strong>Redirect URI</strong> to: <code class="callback-url">{window.location.origin + "/setup/yahoo-callback"}</code></li>
                  <li>Under API Permissions, check <strong>Fantasy Sports (Read)</strong> (and Write if you want roster moves)</li>
                  <li>Copy the Consumer Key and Consumer Secret below</li>
                </ol>
              </div>
              <form onSubmit={handleSubmitCredentials}>
                <div class="form-field">
                  <label for="consumer-key">Consumer Key</label>
                  <input
                    id="consumer-key"
                    type="text"
                    placeholder="dj0yJmk9..."
                    value={consumerKey}
                    onInput={function (e) { setConsumerKey((e.target as HTMLInputElement).value); }}
                    required
                    autoFocus
                  />
                </div>
                <div class="form-field">
                  <label for="consumer-secret">Consumer Secret</label>
                  <input
                    id="consumer-secret"
                    type="password"
                    placeholder="Your consumer secret"
                    value={consumerSecret}
                    onInput={function (e) { setConsumerSecret((e.target as HTMLInputElement).value); }}
                    required
                  />
                </div>
                <button type="submit" class="btn-primary" disabled={submittingCreds || !consumerKey || !consumerSecret}>
                  {submittingCreds ? "Connecting..." : "Connect to Yahoo"}
                </button>
              </form>
            </div>
          )}

          {currentStep === "league" && (
            <div class="step-content">
              <h2>Select Your League</h2>
              {loadingLeagues ? (
                <div class="wizard-loading">
                  <div class="spinner" />
                  <p>Loading your leagues from Yahoo...</p>
                </div>
              ) : leagues.length === 0 ? (
                <p class="empty-state">No fantasy baseball leagues found. Make sure you're in a Yahoo Fantasy Baseball league for the current season.</p>
              ) : (
                <div>
                  <div class="form-field">
                    <label>League</label>
                    <div class="league-cards">
                      {leagues.map(function (league) {
                        return (
                          <button
                            key={league.league_key}
                            class={"league-card" + (selectedLeague === league.league_key ? " selected" : "")}
                            onClick={function () { handleSelectLeague(league.league_key); }}
                          >
                            <span class="league-name">{league.name}</span>
                            <span class="league-meta">{league.season} &middot; {league.num_teams} teams</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {selectedLeague && (
                    <div class="form-field">
                      <label>Your Team</label>
                      {loadingTeams ? (
                        <div class="wizard-loading small">
                          <div class="spinner" />
                          <p>Loading teams...</p>
                        </div>
                      ) : teams.length === 0 ? (
                        <p class="empty-state">No teams found in this league.</p>
                      ) : (
                        <div class="team-cards">
                          {teams.map(function (team) {
                            return (
                              <button
                                key={team.team_key}
                                class={"team-card" + (selectedTeam === team.team_key ? " selected" : "")}
                                onClick={function () { setSelectedTeam(team.team_key); }}
                              >
                                <span class="team-name">{team.name}</span>
                                <span class="team-meta">
                                  {team.manager}
                                  {team.is_owned_by_current_login && <span class="you-badge">You</span>}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    class="btn-primary"
                    disabled={!selectedLeague || !selectedTeam || savingLeague}
                    onClick={handleSaveLeague}
                  >
                    {savingLeague ? "Saving..." : "Continue"}
                  </button>
                </div>
              )}
            </div>
          )}

          {currentStep === "password" && (
            <div class="step-content">
              <h2>Set MCP Password</h2>
              <p class="step-description">
                This password protects your MCP server. You'll use it when connecting from Claude.ai or other MCP clients.
              </p>
              <form onSubmit={handleSavePassword}>
                <div class="form-field">
                  <label for="mcp-password">Password (8+ characters)</label>
                  <div class="password-row">
                    <input
                      id="mcp-password"
                      type="text"
                      placeholder="Enter a strong password"
                      value={password}
                      onInput={function (e) { setPassword((e.target as HTMLInputElement).value); }}
                      required
                      minLength={8}
                      autoFocus
                    />
                    <button type="button" class="btn-secondary" onClick={handleGeneratePassword}>
                      Generate
                    </button>
                  </div>
                </div>
                <button type="submit" class="btn-primary" disabled={savingPassword || password.length < 8}>
                  {savingPassword ? "Saving..." : "Continue"}
                </button>
              </form>
            </div>
          )}

          {currentStep === "complete" && (
            <div class="step-content">
              <h2>You're All Set!</h2>
              <div class="completion-summary">
                <div class="check-list">
                  <div class="check-item done">
                    <CheckIcon />
                    <span>Yahoo API connected</span>
                  </div>
                  <div class="check-item done">
                    <CheckIcon />
                    <span>League &amp; team selected</span>
                  </div>
                  <div class="check-item done">
                    <CheckIcon />
                    <span>MCP password set</span>
                  </div>
                </div>

                {serverUrl ? (
                  <div class="restart-notice">
                    <div class="spinner" />
                    <p>Server is restarting into MCP mode...</p>
                    <p class="hint">This page will stop responding. Use the MCP URL below to connect.</p>
                  </div>
                ) : (
                  <div>
                    <p class="step-description">
                      Click below to finalize setup and restart the server into MCP mode.
                    </p>
                    <button class="btn-primary" onClick={handleComplete} disabled={completing}>
                      {completing ? "Finalizing..." : "Launch BaseClaw"}
                    </button>
                  </div>
                )}

                <div class="connection-info">
                  <h3>Connection Details</h3>
                  <p>Add this MCP server in your Claude client:</p>
                  <div class="info-row">
                    <span class="info-label">Server URL</span>
                    <code>{window.location.origin + "/mcp"}</code>
                  </div>
                  <p class="hint">
                    In Claude.ai, go to Settings &rarr; MCP Servers &rarr; Add Server, paste the URL, and enter your password when prompted.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="9" r="9" fill="#22c55e" opacity="0.15" />
      <path d="M5 9L8 12L13 6" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  );
}

render(<SetupWizard />, document.getElementById("root")!);
