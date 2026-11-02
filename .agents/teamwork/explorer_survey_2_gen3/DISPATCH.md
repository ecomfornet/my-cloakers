## 2026-11-01T12:08:53Z
You are Survey Explorer 2 (teamwork_explorer, Gen 3).
Your working directory is: c:\Users\mouni\Desktop\my-cloaker\.agents\teamwork\explorer_survey_2_gen3
Your parent is the Project Orchestrator (Conversation ID: 99771219-9d06-49a7-a16f-250903dc2536).

CRITICAL REQUIREMENT:
Read the authoritative user request at:
c:\Users\mouni\Desktop\my-cloaker\.agents\teamwork\ORIGINAL_REQUEST.md

OBJECTIVE:
Investigate `c:\Users\mouni\Desktop\my-cloaker\server.js` by inspecting the actual code using `view_file`.
Find all:
1. Endpoints, routes, middleware, and request handling logic in `server.js`.
2. Cloaker functionality: Bot/crawler detection, header parsing, IP inspection, safe vs. money redirect logic, campaign configuration.
3. Vulnerabilities, missing input validations, potential unhandled errors (e.g. malformed JSON, missing properties in POST body, regex edge cases).
4. Missing Express error-handling middleware (`app.use((err, req, res, next) => ...)`).

MANDATORY PROTOCOL:
- IN TURN 1: ONLY use `view_file` to read `c:\Users\mouni\Desktop\my-cloaker\server.js` (e.g. StartLine: 1, EndLine: 400). DO NOT call send_message in Turn 1!
- IN SUBSEQUENT TURNS: Read any remaining lines of `server.js`.
- Then, write your comprehensive analysis report to `c:\Users\mouni\Desktop\my-cloaker\.agents\teamwork\explorer_survey_2_gen3\handoff.md` using `write_to_file`. Quote exact line numbers and code excerpts from your actual file inspection.
- ONLY AFTER `handoff.md` is written, update `progress.md` and call `send_message` to notify your parent (99771219-9d06-49a7-a16f-250903dc2536).

CONSTRAINTS:
- You are strictly read-only regarding codebase files (`server.js`). Do not modify source code.
- Quote verbatim line numbers and actual code — never fabricate code lines.
