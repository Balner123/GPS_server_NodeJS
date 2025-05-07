# PowerShell script for local setup and running the GPS server application

# --- Configuration ---
$env:DB_HOST = "localhost"
$env:DB_USER = "root"
# !!! IMPORTANT: Change $dbRootPassword to your actual MySQL root password !!!
$dbRootPassword = "" # Assumed password, change as needed
$env:DB_PASSWORD = $dbRootPassword 
$env:DB_NAME = "gps_tracking"
$env:PORT = "5000"
$env:CORS_ORIGIN = "*"
$env:RATE_LIMIT_WINDOW = "15"
$env:RATE_LIMIT_MAX = "100"

Write-Host "Step 1: Setting environment variables"
Write-Host "------------------------------------------"
Write-Host "DB_HOST: $env:DB_HOST"
Write-Host "DB_USER: $env:DB_USER"
Write-Host "DB_NAME: $env:DB_NAME"
Write-Host "PORT: $env:PORT"
Write-Host "CORS_ORIGIN: $env:CORS_ORIGIN"
Write-Host "------------------------------------------"
Write-Host ""

Write-Host "Step 2: Initializing MySQL Database"
Write-Host "------------------------------------------"
Write-Host "Attempting to create database '$($env:DB_NAME)' and import 'init-db.sql'."
Write-Host "This requires MySQL command-line tools to be installed and in your PATH."

$mysqlUser = $env:DB_USER
$mysqlRootPassword = $dbRootPassword # This is "" as per user's change
$mysqlDbName = $env:DB_NAME
$initSqlFile = ".\\init-db.sql"

$mysqlExe = "mysql" # Assuming mysql is in PATH

# Common arguments for mysql client
$commonMysqlArgs = @("--user=$($mysqlUser)")
if ($mysqlRootPassword -ne "") {
    $commonMysqlArgs += "--password=$($mysqlRootPassword)"
}

# 1. Create database if not exists
# SQL backticks (`) are used to quote the database name for MySQL, in case it contains special characters or is a reserved word.
# PowerShell's backtick is also used here to escape the $ for variable expansion within the SQL string.
$createDbSql = "CREATE DATABASE IF NOT EXISTS \`$($mysqlDbName)\`;"
Write-Host "Executing MySQL command to create database (if not exists): $mysqlExe $($commonMysqlArgs -join ' ') -e \`\"$($createDbSql)\`\"\"
try {
    & $mysqlExe @commonMysqlArgs -e $createDbSql
    Write-Host "Database '$($mysqlDbName)' creation command executed successfully or database already existed."
} catch {
    Write-Warning "An error occurred during database creation command. Error: $($_.Exception.Message)"
    # This might not be fatal if DB already existed. Script will continue.
}

# 2. Import data into the database
Write-Host "Executing MySQL command to import data from '$($initSqlFile)' into '$($mysqlDbName)'..."
try {
    # Using Get-Content -Raw to read the entire file as a single string, then pipe to mysql
    Get-Content -Raw -Path $initSqlFile | & $mysqlExe @commonMysqlArgs $mysqlDbName
    Write-Host "Successfully imported '$($initSqlFile)' into '$($mysqlDbName)' via PowerShell piping."
} catch {
    Write-Error "Failed to import '$($initSqlFile)' into database '$($mysqlDbName)'. Error: $($_.Exception.Message)"
    
    # Constructing manual command examples for display. Using single quotes for literals where possible.
    $psExample = "Get-Content -Raw -Path '$initSqlFile' | & '$mysqlExe' $($commonMysqlArgs -join ' ') '$mysqlDbName'"
    Write-Error "You may need to run the import command manually. Example for PowerShell:"
    Write-Error $psExample
    
    $cmdExample = "'$mysqlExe' $($commonMysqlArgs -join ' ') '$mysqlDbName' < '$initSqlFile'"
    Write-Error "Example for Command Prompt (cmd.exe):"
    Write-Error $cmdExample
    exit 1
}

Write-Host "Database initialization attempt complete."
Write-Host "------------------------------------------"
Write-Host ""

Write-Host "Step 3: Installing Node.js dependencies"
Write-Host "------------------------------------------"
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Error "Error during npm install. Check the output and try again."
    exit 1
}
Write-Host "Dependencies installed successfully."
Write-Host "------------------------------------------"
Write-Host ""

Write-Host "Step 4: Starting the application"
Write-Host "------------------------------------------"
Write-Host "Starting server on http://$($env:DB_HOST):$($env:PORT) (or http://localhost:$($env:PORT))"
npm start

Write-Host "Application started. Press Ctrl+C in the terminal where the server is running to stop it."
