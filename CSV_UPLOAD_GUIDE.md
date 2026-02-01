# CSV Bulk Upload - Feature Guide

## ✅ Feature Implemented
College admins can now **Bulk Upload Candidates** via CSV in the "Add Candidates" modal.

### **How it Works**

1.  **Download Template**: Click "Download Template" to get the correct CSV format.
2.  **Fill Data**: Add student details (name, email mandatory).
3.  **Upload CSV**: Click "Upload CSV" button and select your file.
4.  **Auto-Select**: The system parses the file and automatically adds valid students to the "Selected Students" list.
5.  **Review & Add**: You can remove specific students if needed, then click "Add Selected" to finalize.

### **CSV Format**
- **headers**: `name,email,student_id,phone,branch,graduation_year`
- **mandatory**: `name`, `email`
- `student_id` is optional but recommended.

### **Validation logic**
- Checks for `name` and `email` columns.
- Skips empty rows.
- Checks if the candidate is already selected (hides duplicates).
- Shows an error message if the CSV is invalid or empty.

### **UI Changes**
- Added **Upload CSV** button next to Download Template.
- Hidden file input for seamless experience.
- Parsing happens entirely client-side (fast, secure).

---

**Status**: Ready to use.
**Location**: Template Dashboard -> "Add Candidates" Modal.
