import sys

with open('app/api/tailor/route.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# The exact old output schema (without header/education)
OLD_MARKER = 'OUTPUT FORMAT (JSON ONLY, use \\\\n for newlines inside strings. ONLY output the sections below):\r\n{\r\n    "summary": "...",\r\n    "skills": "...",\r\n    "experience": "...",\r\n    "projects": "...",\r\n    "corrections": [\r\n        {"section": "skills", "action": "removed", "detail": "Kubernetes - not in original resume"}\r\n    ]\r\n}`'

NEW_SCHEMA = 'OUTPUT FORMAT (JSON ONLY, use \\\\\\\\n for newlines inside strings. Output ALL sections below):\r\n{\r\n    "header": "# Name\\\\\\\\nemail | phone | ...",\r\n    "summary": "...",\r\n    "skills": "...",\r\n    "experience": "...",\r\n    "education": "**Degree** | **University** | **Dates**",\r\n    "projects": "...",\r\n    "corrections": [\r\n        {"section": "skills", "action": "removed", "detail": "Kubernetes - not in original resume"}\r\n    ]\r\n}`'

# Also fix the instructions to add header instruction and update education wording  
OLD_INSTRUCTIONS_END = '3. **Summary**: Ensure it accurately reflects the original resume\'s level of experience. Keyword inclusion is FINE.\r\n4. **Education**: Ensure no degrees, institutions, or honors were fabricated.\r\n\r\nOUTPUT FORMAT (JSON ONLY, use \\\\n for newlines inside strings. ONLY output the sections below):'

NEW_INSTRUCTIONS_END = '3. **Summary**: Ensure it accurately reflects the original resume\'s level of experience. Keyword inclusion is FINE.\r\n4. **Header**: Ensure the candidate\'s name and contact details are unchanged/undamaged from the original. Format MUST be: `# Name` on line 1, contact info on line 2 separated by ` | `.\r\n5. **Education**: Ensure no degrees, institutions, or honors were fabricated. Return education unchanged if it looks correct.\r\n\r\nOUTPUT FORMAT (JSON ONLY, use \\\\\\\\n for newlines inside strings. Output ALL sections below):'

if OLD_INSTRUCTIONS_END in content:
    content = content.replace(OLD_INSTRUCTIONS_END, NEW_INSTRUCTIONS_END)
    print('SUCCESS: Instructions updated')
else:
    print('ERROR: Could not find instructions end marker')
    # Print the area around "ONLY output" for debugging
    idx = content.find('ONLY output the sections below')
    if idx >= 0:
        print('Found at idx', idx)
        snippet = content[max(0,idx-300):idx+200]
        print(repr(snippet))
    sys.exit(1)

# Now fix the output schema
OLD_OUTPUT = '"projects": "...",\r\n    "corrections": [\r\n        {"section": "skills", "action": "removed", "detail": "Kubernetes - not in original resume"}\r\n    ]\r\n}`'

NEW_OUTPUT = '"education": "**Degree** | **University** | **Dates**",\r\n    "projects": "...",\r\n    "corrections": [\r\n        {"section": "skills", "action": "removed", "detail": "Kubernetes - not in original resume"}\r\n    ]\r\n}`'

if OLD_OUTPUT in content:
    content = content.replace(OLD_OUTPUT, NEW_OUTPUT, 1)  # replace only first occurrence (CoVe schema)
    print('SUCCESS: Output schema updated')
else:
    print('ERROR: Could not find output schema')
    sys.exit(1)

# Add header to output schema
OLD_SUMMARY_START = '"summary": "...",'
# Find the one inside the CoVe output block by checking context
idx = content.find(NEW_INSTRUCTIONS_END)
if idx >= 0:
    schema_start = content.find('"summary": "...",', idx)
    if schema_start >= 0:
        content = content[:schema_start] + '"header": "# Name\\\\\\\\nemail | phone | ...",\r\n    ' + content[schema_start:]
        print('SUCCESS: Header field added to CoVe output schema')
    else:
        print('ERROR: Could not find summary field after instructions')
        sys.exit(1)

with open('app/api/tailor/route.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print('ALL DONE')
