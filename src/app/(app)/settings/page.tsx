export default async function SettingsPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ agencyKey?: string; demo?: string }>;
}>) {
  const params = await searchParams;
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const agencyKey = params.agencyKey || "YOUR_AGENCY_API_KEY";
  const embedScript = `<script>\n(function() {\n  var script = document.createElement(\"script\");\n  script.src = \"${appUrl}/widget.js\";\n  script.async = true;\n  script.onload = function() {\n    window.AIWidget.init({\n      agencyKey: \"${agencyKey}\"\n    });\n  };\n  document.head.appendChild(script);\n})();\n</script>`;

  return (
    <>
      <section className="settings-hero surface-card surface-glass">
        <div>
          <h2 className="dashboard-title">Settings</h2>
          <p className="dashboard-subtitle">Control branding, qualification logic, channel behavior, and deployment quality.</p>
        </div>
        <div className="settings-hero-badges">
          <span className="settings-pill">Multi-channel Ops</span>
          <span className="settings-pill">Conversion Governance</span>
          <span className="settings-pill">Widget Deployment</span>
        </div>
      </section>

      <section className="settings-layout">
        <div className="settings-main">
          <div className="settings-grid">
            <article className="settings-panel surface-card">
              <div className="settings-panel-header">
                <h3>Branding</h3>
                <p>Identity and visual trust signals used across your assistant and widget.</p>
              </div>
              <div className="settings-fields">
                <label className="settings-field">
                  <span className="settings-label">Agency Name</span>
                  <input className="input" defaultValue="Demo Realty" />
                </label>
                <label className="settings-field">
                  <span className="settings-label">Logo URL</span>
                  <input className="input" placeholder="https://.../logo.png" />
                </label>
                <label className="settings-field">
                  <span className="settings-label">Primary Color</span>
                  <input className="input" defaultValue="#1e3a8a" />
                </label>
              </div>
            </article>

            <article className="settings-panel surface-card">
              <div className="settings-panel-header">
                <h3>Qualification Rules</h3>
                <p>Define lead scoring and mandatory capture criteria for AI conversations.</p>
              </div>
              <div className="settings-fields">
                <label className="settings-field">
                  <span className="settings-label">Minimum Budget</span>
                  <input className="input" defaultValue="50000" />
                </label>
                <label className="settings-field">
                  <span className="settings-label">Mandatory Fields</span>
                  <textarea className="textarea" defaultValue="location, budget, property_type, timeline, full_name, contact" />
                </label>
                <label className="settings-field">
                  <span className="settings-label">Hot Lead Trigger</span>
                  <select className="select" defaultValue="asap_or_this_week">
                    <option value="asap_or_this_week">Timeline = ASAP or This Week + Contact</option>
                    <option value="high_budget">Budget threshold + contact</option>
                  </select>
                </label>
              </div>
            </article>
          </div>

          <article className="settings-panel surface-card settings-embed">
            <div className="settings-panel-header">
              <h3>Embed Widget</h3>
              <p>Deploy your branded assistant on any property website using one secure snippet.</p>
            </div>
            <pre className="settings-code">{embedScript}</pre>
            <div className="settings-actions">
              <button className="action-btn btn-primary">Save Settings</button>
              <button className="action-btn btn-secondary">Test Widget</button>
            </div>
          </article>
        </div>

        <aside className="settings-aside surface-card">
          <h3>Readiness</h3>
          <p>Suggested pre-launch checks for a production-grade deployment.</p>
          <ul>
            <li>Branding profile completed</li>
            <li>Qualification rules validated</li>
            <li>Channel provider configured</li>
            <li>Widget snippet installed</li>
          </ul>
          <div className="settings-aside-footer">Enterprise profile: 85% complete</div>
        </aside>
      </section>
    </>
  );
}
