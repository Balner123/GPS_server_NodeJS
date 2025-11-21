#pragma once

#include <pgmspace.h>

// HTML for OTA upload page
const char update_form_page[] PROGMEM = R"rawliteral(
  <html>
  <head>
    <title>OTA Update</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f4f4f4; display: flex; justify-content: center; align-items: center; min-height: 90vh; text-align: center; }
      .container { background-color: #fff; padding: 30px; border-radius: 8px; box-shadow: 0 0 10px rgba(0,0,0,0.1); max-width: 400px; width: 100%; }
      h1 { color: #333; }
      p { color: #555; line-height: 1.5; }
      .status { padding: 10px; border-radius: 4px; margin: 15px 0; font-weight: bold; }
      .status.ok { background-color: #d4edda; color: #155724; }
      .status.fail { background-color: #f8d7da; color: #721c24; }
  .status.pending { background-color: #fff3cd; color: #856404; }
      .registration-detail { color: #555; font-size: 0.9em; min-height: 1.2em; }
      .form-group { margin-bottom: 15px; text-align: left; }
      label { display: block; margin-bottom: 5px; font-weight: bold; }
      input[type='text'], input[type='password'], input[type='file'] { width: calc(100% - 22px); padding: 10px; border: 1px solid #ddd; border-radius: 4px; } /* Added input[type='file'] */
      input[type='submit'] { background-color: #28a745; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; font-size: 1em; width: 100%; } /* Changed color to green */
      input[type='submit']:hover { background-color: #218838; } /* Changed hover color */
      .nav-menu { margin-top: 20px; padding-top: 10px; border-top: 1px solid #eee; }
      .nav-menu a { margin: 0 10px; color: #007bff; text-decoration: none; }
      .nav-menu a:hover { text-decoration: underline; }
    </style>
  </head>
  <body>
    <div class="container">
      <h1> GPSTracker Update</h1>
      <p><b>Device ID:</b> %id%</p>
      <form method='POST' action='/update' enctype='multipart/form-data'>
        <input type='file' name='update' accept='.bin' required><br>
        <input type='submit' value='Upload and Update'>
      </form>
      <div class="nav-menu">
        <a href="/">Main Page</a> | 
        <a href="/settings">Settings</a>
      </div>
    </div>
  </body>
  </html>
)rawliteral";

// HTML for success page
const char success_page[] PROGMEM = R"rawliteral(
  <html><head><title>OTA Update Success</title>
  <style>body{font-family: Arial, sans-serif; text-align: center; padding-top: 50px;} .message{color: green; font-size: 1.2em;}</style></head>
  <body>
    <h1>OTA Update Successful!</h1>
    <p class="message">Firmware has been updated.<br>Please manually power cycle the device and switch to ON mode.</p>
    <p><a href="/">Upload another file</a></p>
  </body></html>
)rawliteral";

// HTML for failure page template
const char failure_page_template[] PROGMEM = R"rawliteral(
  <html><head><title>OTA Update Failed</title>
  <style>body{font-family: Arial, sans-serif; text-align: center; padding-top: 50px;} .message{color: red; font-size: 1.2em;}</style></head>
  <body>
    <h1>OTA Update Failed!</h1>
    <p class="message">Error: %s</p>
    <p><a href="/">Try again</a></p>
  </body></html>
)rawliteral";

// --- HTML for OTA Response Page ---
const char ota_response_page_template[] PROGMEM = R"rawliteral(
  <html>
  <head>
    <title>Registration Status</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f4f4f4; display: flex; justify-content: center; align-items: center; min-height: 90vh; text-align: center; }
      .container { background-color: #fff; padding: 30px; border-radius: 8px; box-shadow: 0 0 10px rgba(0,0,0,0.1); max-width: 400px; width: 100%; }
      h1 { color: #333; }
      p { color: #555; line-height: 1.5; }
      .status-message { padding: 10px; border-radius: 4px; margin: 20px 0; font-weight: bold; font-size: 1.1em; }
      .status-message.ok { background-color: #d4edda; color: #155724; }
      .status-message.fail { background-color: #f8d7da; color: #721c24; }
      a { color: #007bff; text-decoration: none; margin-top: 15px; display: inline-block; }
      a:hover { text-decoration: underline; } 
    </style>
  </head>
  <body>
    <div class="container">
      <h1>Registration Status</h1>
      <div class="status-message %status_class%">%message%</div>
      <a href="/">Go Back</a>
    </div>
  </body>
  </html>
)rawliteral";

// --- HTML for OTA Main Page ---
const char ota_main_page_template[] PROGMEM = R"rawliteral(
  <html>
  <head>
    <title>Device OTA & Registration</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f4f4f4; display: flex; justify-content: center; align-items: center; min-height: 90vh; text-align: center; }
      .container { background-color: #fff; padding: 30px; border-radius: 8px; box-shadow: 0 0 10px rgba(0,0,0,0.1); max-width: 400px; width: 100%; }
      h1 { color: #333; }
      p { color: #555; line-height: 1.5; }
      .status { padding: 10px; border-radius: 4px; margin: 15px 0; font-weight: bold; }
      .status.ok { background-color: #d4edda; color: #155724; }
      .status.fail { background-color: #f8d7da; color: #721c24; }
      .form-group { margin-bottom: 15px; text-align: left; }
      label { display: block; margin-bottom: 5px; font-weight: bold; }
      input[type='text'], input[type='password'] { width: calc(100% - 22px); padding: 10px; border: 1px solid #ddd; border-radius: 4px; }
      input[type='submit'] { background-color: #28a745; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; font-size: 1em; width: 100%; }
      input[type='submit']:hover { background-color: #218838; }
      .nav-menu { margin-top: 20px; padding-top: 10px; border-top: 1px solid #eee; }
      .nav-menu a { margin: 0 10px; color: #007bff; text-decoration: none; }
      .nav-menu a:hover { text-decoration: underline; }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>Device Service Mode</h1>
      <p><b>Device ID:</b> %id%</p>
      <p><b>GPRS Status:</b> <span class="status %gprs_status_class%">%gprs_status%</span></p>
  <p><b>Registration:</b> <span class="status %registration_status_class%">%registration_status%</span></p>
  <p class="registration-detail">%registration_detail%</p>
      <hr>
      <h2>Register Device</h2>
      <p>If this device is not registered, enter your account details below.</p>
      <form method='POST' action='/doregister'>
        <div class="form-group">
          <label for="username">Username:</label>
          <input type='text' id="username" name='username' required>
        </div>
        <div class="form-group">
          <label for="password">Password:</label>
          <input type='password' id="password" name='password' required>
        </div>
        <input type='submit' value='Register Device'>
      </form>
      <div class="nav-menu">
        <a href="/settings">Settings</a> | 
        <a href="/update">Firmware Update</a>
      </div>
    </div>
  </body>
  </html>
)rawliteral";

// --- HTML for Settings Page ---
const char settings_page_template[] PROGMEM = R"rawliteral(
  <html>
  <head>
    <title>Device Settings</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      body { font-family: Arial, sans-serif; margin: 20px; background-color: #f4f4f4; }
      .container { background-color: #fff; padding: 30px; border-radius: 8px; box-shadow: 0 0 10px rgba(0,0,0,0.1); max-width: 600px; margin: auto; }
      h1, h2 { color: #333; text-align: center; }
      .form-group { margin-bottom: 15px; }
      label { display: block; margin-bottom: 5px; font-weight: bold; }
      input[type='text'], input[type='password'], input[type='number'] { width: calc(100% - 22px); padding: 10px; border: 1px solid #ddd; border-radius: 4px; }
      input[type='submit'] { background-color: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; font-size: 1em; width: 100%; }
      input[type='submit']:hover { background-color: #0056b3; }
      .nav-menu { margin-top: 20px; text-align: center; padding-top: 10px; border-top: 1px solid #eee; }
      .nav-menu a { margin: 0 10px; color: #007bff; text-decoration: none; }
      .nav-menu a:hover { text-decoration: underline; }
      hr { border: 0; border-top: 1px solid #eee; margin: 20px 0; }
      .section-header { display: flex; justify-content: space-between; align-items: center; }
      .test-btn { padding: 5px 10px; font-size: 0.9em; cursor: pointer; }
      .loader { border: 4px solid #f3f3f3; border-radius: 50%; border-top: 4px solid #3498db; width: 16px; height: 16px; animation: spin 2s linear infinite; display: none; margin-left: 10px; }
      @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      .section-container { padding: 20px; border-radius: 5px; transition: background-color 0.5s ease; }
      .section-container.success { background-color: #d4edda; }
      .section-container.failure { background-color: #f8d7da; }
      .test-result { margin-top: 10px; font-weight: bold; min-height: 1.2em; }
      .test-result.ok { color: #155724; }
      .test-result.fail { color: #721c24; }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>Device Settings</h1>
      <form method='POST' action='/savesettings' onsubmit="return validatePasswords()">
        
        <div id="gprs-section" class="section-container">
          <div class="section-header">
            <h2>GPRS Configuration</h2>
            <div style="display: flex; align-items: center;">
              <button type="button" id="test-gprs-btn" class="test-btn" onclick="testGPRS()">Test</button>
              <div id="gprs-loader" class="loader"></div>
            </div>
          </div>
          <div id="gprs-result" class="test-result"></div>
          <div class="form-group">
            <label for="apn">APN:</label>
            <input type='text' id="apn" name='apn' value='%apn%'>
          </div>
          <div class="form-group">
            <label for="gprsUser">GPRS User:</label>
            <input type='text' id="gprsUser" name='gprsUser' value='%gprsUser%'>
          </div>
          <div class="form-group">
            <label for="gprsPass">GPRS Password:</label>
            <input type='text' id="gprsPass" name='gprsPass' value='%gprsPass%'>
          </div>
          <div class="form-group">
            <label for="gprsPassConfirm">Confirm GPRS Password:</label>
            <input type='text' id="gprsPassConfirm" name='gprsPassConfirm' value='%gprsPass%'>
          </div>
        </div>

        <hr>

        <div id="server-section" class="section-container">
          <div class="section-header">
            <h2>Server Configuration</h2>
            <div style="display: flex; align-items: center;">
              <button type="button" id="test-server-btn" class="test-btn" onclick="testServer()" %server_btn_disabled%>Test</button>
              <div id="server-loader" class="loader"></div>
            </div>
          </div>
          <div id="server-result" class="test-result"></div>
          <div class="form-group">
            <label for="server">Server Hostname/IP:</label>
            <input type='text' id="server" name='server' value='%server%'>
          </div>
          <div class="form-group">
            <label for="port">Server Port:</label>
            <input type='number' id="port" name='port' value='%port%'>
          </div>
        </div>

        <hr>
        <h2>Device Configuration</h2>
        <div class="form-group">
          <label for="deviceName">Device Name:</label>
          <input type='text' id="deviceName" name='deviceName' value='%deviceName%'>
        </div>
        <hr>
        <h2>OTA Hotspot Configuration</h2>
        <div class="form-group">
          <label>OTA WiFi SSID:</label>
          <p style="padding: 10px; background: #eee; border-radius: 4px; margin-top: 0;">%ota_ssid%</p>
        </div>
        <p style="font-size:0.9em;color:#555;">Hotspot runs as an Open Network for easier service access.</p>
        
        <hr>
        
        <div id="cache-section" class="section-container">
          <div class="section-header">
             <h2>Data Cache Management</h2>
          </div>
          <p>Current Cache Size: <b><span id="cache-size-display">%cache_size%</span> bytes</b></p>
          <p style="font-size:0.9em;color:#555;">Clear cache if you encounter "Invalid device payload" errors or stuck data.</p>
                    <button type="button" class="test-btn" style="background-color: #dc3545; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; width: 100%;" onclick="confirmClearCache()">Clear Cache</button>
                  </div>
          
                  <br>
                  <div id="saving-indicator" style="display:none; color: #0056b3; font-weight: bold; margin-bottom: 10px;">Saving settings... Please wait...</div>
                  <input type='submit' id="save-btn" value='Save Settings'>
                </form>
                <div class="nav-menu">
                  <a href="/">Main Page</a> |
                  <a href="/update">Firmware Update</a>
                </div>
              </div>
              <script>
                // Replace the direct onsubmit with this handler wrapper
                document.querySelector('form[action="/savesettings"]').onsubmit = function() {
                  if (!validatePasswords()) return false;
                  document.getElementById('save-btn').style.display = 'none';
                  document.getElementById('saving-indicator').style.display = 'block';
                  return true;
                };
          
                function confirmClearCache() {
                  if (confirm("Are you sure you want to delete all cached GPS data? This cannot be undone.")) {
                    // Create a form to submit the POST request
                    var form = document.createElement('form');
                    form.method = 'POST';
                    form.action = '/clearcache';
                    document.body.appendChild(form);
                    form.submit();
                  }
                }
          
                      function validatePasswords() {
                        var gprsPass = document.getElementById('gprsPass').value;
                        var gprsPassConfirm = document.getElementById('gprsPassConfirm').value;
                
                        if (gprsPass !== gprsPassConfirm) {
                          alert('GPRS passwords do not match!');
                          return false;
                        }
                        return true;
                      }          
                function testGPRS() {
        const btn = document.getElementById('test-gprs-btn');
        const loader = document.getElementById('gprs-loader');
        const section = document.getElementById('gprs-section');
        const result = document.getElementById('gprs-result');
        
        btn.disabled = true;
        loader.style.display = 'block';
        section.className = 'section-container';
        result.textContent = '';
        result.className = 'test-result';

        const apn = document.getElementById('apn').value;
        const user = document.getElementById('gprsUser').value;
        const pass = document.getElementById('gprsPass').value;

        fetch(`/testgprs?apn=${encodeURIComponent(apn)}&user=${encodeURIComponent(user)}&pass=${encodeURIComponent(pass)}`)
          .then(response => response.json())
          .then(data => {
            section.classList.add(data.success ? 'success' : 'failure');
            result.textContent = data.message || (data.success ? 'GPRS test passed.' : 'GPRS test failed.');
            result.className = 'test-result ' + (data.success ? 'ok' : 'fail');
            if (data.restored === false) {
              result.textContent += ' Device did not reconnect with stored credentials.';
            }
            lastGprsTestSuccess = data.success;
            document.getElementById('test-server-btn').disabled = !data.success;
          })
          .catch(err => {
            section.classList.add('failure');
            result.textContent = 'Error while testing GPRS connection.';
            result.className = 'test-result fail';
            console.error('Error:', err);
            lastGprsTestSuccess = false;
            document.getElementById('test-server-btn').disabled = true;
          })
          .finally(() => {
            btn.disabled = false;
            loader.style.display = 'none';
          });
      }

      function testServer() {
        const btn = document.getElementById('test-server-btn');
        const loader = document.getElementById('server-loader');
        const section = document.getElementById('server-section');
        const result = document.getElementById('server-result');

        if (!lastGprsTestSuccess) {
          section.className = 'section-container failure';
          result.textContent = 'Run a successful GPRS test before testing the server.';
          result.className = 'test-result fail';
          return;
        }

        btn.disabled = true;
        loader.style.display = 'block';
        section.className = 'section-container';
        result.textContent = '';
        result.className = 'test-result';

        const host = document.getElementById('server').value;
        const port = document.getElementById('port').value;

        fetch(`/testserver?host=${encodeURIComponent(host)}&port=${encodeURIComponent(port)}`)
          .then(response => response.json())
          .then(data => {
            section.classList.add(data.success ? 'success' : 'failure');
            result.textContent = data.message || (data.success ? 'Server reachable.' : 'Server test failed.');
            result.className = 'test-result ' + (data.success ? 'ok' : 'fail');
          })
          .catch(err => {
            section.classList.add('failure');
            result.textContent = 'Error while testing server connection.';
            result.className = 'test-result fail';
            console.error('Error:', err);
          })
          .finally(() => {
            btn.disabled = false;
            loader.style.display = 'none';
          });
      }
    </script>
  </body>
  </html>
)rawliteral";
