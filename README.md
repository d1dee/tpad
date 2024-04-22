# Automatic Attendance Data Filler for TPAD

## Overview

This command-line utility program is designed to automate the process of filling weekly attendance
data to tpad.tsc.go.ke. It streamlines the process by taking in necessary arguments and a sample Excel 
file containing the attendance data.

## Usage
To use the program, you need to provide the following arguments:

`--tsc_number:` Your TSC (Teachers Service Commission) number. <br>
`--id_number:` Your identification number.<br>
`--password:` Your password for accessing the TPAD system.<br>
`--excel_file:` Path to the sample Excel file containing the attendance data.<br>

## Instructions
1. Clone this repository to your local machine.
2. Install dependencies by running npm install.
3. Build the project by running npm run build. This will compile the TypeScript files and generate the output in a folder
4. named out.
5. Navigate to the out folder.
6. Run the program by executing node index.js with the appropriate arguments mentioned above.

[<h2>Sample Excel File <img src="xlsx_icon.png" height="20" alt="excel icon"></h2>](sample.xlsx)

### Note
This program is written in TypeScript. If you make any changes to the TypeScript files, make sure to rebuild the project
before running it again.

### Disclaimer
This program is provided as-is, without any guarantees or warranties. Use it responsibly and ensure that you have the 
necessary permissions to access and fill data on tpad.tsc.go.ke.
