"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Search, Edit2, Trash2, Download, Upload, X, Check } from "lucide-react";
import Card from "@/components/Card";
import Container from "@/components/Container";
import Badge from "@/components/Badge";
import Skeleton from "@/components/Skeleton";

type Student = {
  id: string;
  email: string;
  name: string;
  student_id?: string;
  phone?: string;
  department?: string;
  year?: string;
  batch?: string;
  created_at: string;
};

export default function StudentsPage() {
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState<string>("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [formData, setFormData] = useState({
    email: "",
    name: "",
    studentId: "",
    phone: "",
    department: "",
    year: "",
    batch: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [departments, setDepartments] = useState<string[]>([]);

  useEffect(() => {
    fetchStudents();
  }, [searchQuery, departmentFilter]);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append("search", searchQuery);
      if (departmentFilter) params.append("department", departmentFilter);

      const res = await fetch(`/api/college/students?${params.toString()}`);
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || data.message || "Failed to fetch students");
      }

      const responseData = data.data || data;
      const studentsList: Student[] = responseData.students || [];
      setStudents(studentsList);
      
      // Extract unique departments
      const depts: string[] = [...new Set(studentsList.map(s => s.department).filter((d): d is string => typeof d === 'string' && d.length > 0))];
      setDepartments(depts.sort());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load students");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const url = editingStudent 
        ? `/api/college/students/${editingStudent.id}`
        : "/api/college/students";
      
      const method = editingStudent ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email,
          name: formData.name,
          studentId: formData.studentId || undefined,
          phone: formData.phone || undefined,
          department: formData.department || undefined,
          year: formData.year || undefined,
          batch: formData.batch || undefined,
        }),
      });

      const data = await res.json();
      
      if (!res.ok) {
        const errorMessage = data.error || data.message || "Failed to save student";
        console.error("Failed to save student:", { status: res.status, data });
        setError(errorMessage);
        throw new Error(errorMessage);
      }
      
      console.log("Student saved successfully:", data);

      // Success - clear error and close modal
      setError(null);
      setShowAddModal(false);
      setEditingStudent(null);
      setFormData({ email: "", name: "", studentId: "", phone: "", department: "", year: "", batch: "" });
      fetchStudents();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save student");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (student: Student) => {
    setError(null);
    setEditingStudent(student);
    setFormData({
      email: student.email,
      name: student.name,
      studentId: student.student_id || "",
      phone: student.phone || "",
      department: student.department || "",
      year: student.year || "",
      batch: student.batch || "",
    });
    setShowAddModal(true);
  };

  const handleDelete = async (studentId: string) => {
    if (!confirm("Are you sure you want to delete this student?")) return;

    try {
      const res = await fetch(`/api/college/students/${studentId}`, {
        method: "DELETE",
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || data.message || "Failed to delete student");
      }

      fetchStudents();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete student");
    }
  };

  const exportCSV = () => {
    const headers = ["Name", "Email", "Student ID", "Phone", "Department", "Year", "Batch"];
    const rows = students.map(s => [
      s.name,
      s.email,
      s.student_id || "",
      s.phone || "",
      s.department || "",
      s.year || "",
      s.batch || "",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `students-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleBulkImport = async (file: File) => {
    try {
      const text = await file.text();
      const lines = text.split("\n").filter(l => l.trim());
      if (lines.length < 2) {
        throw new Error("CSV must have at least a header row and one data row");
      }

      const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
      const emailIdx = headers.findIndex(h => h.includes("email"));
      const nameIdx = headers.findIndex(h => h.includes("name"));
      const idIdx = headers.findIndex(h => h.includes("student") || h.includes("id"));
      const deptIdx = headers.findIndex(h => h.includes("department") || h.includes("dept"));
      const yearIdx = headers.findIndex(h => h.includes("year"));
      const batchIdx = headers.findIndex(h => h.includes("batch"));
      const phoneIdx = headers.findIndex(h => h.includes("phone"));

      if (emailIdx < 0 || nameIdx < 0) {
        throw new Error("CSV must have 'email' and 'name' columns");
      }

      const studentsToAdd: any[] = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(",").map(v => v.trim().replace(/^"|"$/g, ""));
        const email = values[emailIdx] || "";
        const name = values[nameIdx] || "";
        
        if (email && name) {
          studentsToAdd.push({
            email,
            name,
            studentId: idIdx >= 0 ? values[idIdx] : undefined,
            department: deptIdx >= 0 ? values[deptIdx] : undefined,
            year: yearIdx >= 0 ? values[yearIdx] : undefined,
            batch: batchIdx >= 0 ? values[batchIdx] : undefined,
            phone: phoneIdx >= 0 ? values[phoneIdx] : undefined,
          });
        }
      }

      // Add students one by one
      let successCount = 0;
      let errorCount = 0;
      for (const student of studentsToAdd) {
        try {
          const res = await fetch("/api/college/students", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(student),
          });
          if (res.ok) {
            successCount++;
          } else {
            errorCount++;
          }
        } catch {
          errorCount++;
        }
      }

      alert(`Import complete: ${successCount} added, ${errorCount} failed`);
      fetchStudents();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import CSV");
    }
  };

  return (
    <Container className="py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link
            href="/college/dashboard"
            className="flex items-center gap-2 text-[var(--muted)] hover:text-[var(--text)] transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </Link>
          <h1 className="text-2xl font-semibold text-[var(--text)] mb-2">Student Management</h1>
          <p className="text-[var(--muted)]">Manage your college's student database</p>
        </div>
        <div className="flex gap-2">
          <label className="app-btn-secondary px-4 py-2 cursor-pointer flex items-center gap-2">
            <Upload className="w-4 h-4" />
            Import CSV
            <input
              type="file"
              accept=".csv"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleBulkImport(file);
              }}
              className="hidden"
            />
          </label>
          <button
            onClick={() => {
              setError(null);
              setEditingStudent(null);
              setFormData({ email: "", name: "", studentId: "", phone: "", department: "", year: "", batch: "" });
              setShowAddModal(true);
            }}
            className="app-btn-primary px-6 py-2 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Student
          </button>
        </div>
      </div>

      {error && (
        <Card className="app-card mb-6">
          <div className="rounded-lg bg-[var(--danger-bg)] border border-[var(--danger)] p-4">
            <p className="text-sm text-[var(--danger)]">{error}</p>
          </div>
        </Card>
      )}

      {/* Filters */}
      <Card className="app-card mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
            <input
              type="text"
              placeholder="Search by name, email, or student ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 app-input"
            />
          </div>
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="app-input"
          >
            <option value="">All Departments</option>
            {departments.map(dept => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
          <button
            onClick={exportCSV}
            className="app-btn-secondary px-4 py-2 flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </Card>

      {/* Students Table */}
      <Card className="app-card overflow-hidden">
        {loading ? (
          <div className="p-8">
            <Skeleton className="h-12 mb-4" />
            <Skeleton className="h-12 mb-4" />
            <Skeleton className="h-12" />
          </div>
        ) : students.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-[var(--muted)] mb-4">No students found</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="app-btn-primary px-6 py-2"
            >
              Add First Student
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[var(--bg)] border-b border-[var(--border)]">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text)]">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text)]">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text)]">Student ID</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text)]">Department</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text)]">Year</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text)]">Batch</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text)]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student.id} className="border-b border-[var(--border)] hover:bg-[var(--bg)]">
                    <td className="px-4 py-3 text-sm text-[var(--text)]">{student.name}</td>
                    <td className="px-4 py-3 text-sm text-[var(--muted)]">{student.email}</td>
                    <td className="px-4 py-3 text-sm text-[var(--muted)]">{student.student_id || "-"}</td>
                    <td className="px-4 py-3 text-sm text-[var(--muted)]">{student.department || "-"}</td>
                    <td className="px-4 py-3 text-sm text-[var(--muted)]">{student.year || "-"}</td>
                    <td className="px-4 py-3 text-sm text-[var(--muted)]">{student.batch || "-"}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(student)}
                          className="text-[var(--primary)] hover:text-blue-800 p-1"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(student.id)}
                          className="text-red-600 hover:text-[var(--danger)] p-1"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[var(--text)]">
                {editingStudent ? "Edit Student" : "Add Student"}
              </h3>
              <button
                onClick={() => {
                  setError(null);
                  setShowAddModal(false);
                  setEditingStudent(null);
                  setFormData({ email: "", name: "", studentId: "", phone: "", department: "", year: "", batch: "" });
                }}
                className="text-[var(--muted)] hover:text-[var(--text)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text)] mb-2">
                    Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="w-full app-input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text)] mb-2">
                    Email *
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    className="w-full app-input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text)] mb-2">
                    Student ID
                  </label>
                  <input
                    type="text"
                    value={formData.studentId}
                    onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                    className="w-full app-input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text)] mb-2">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full app-input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text)] mb-2">
                    Department
                  </label>
                  <input
                    type="text"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full app-input"
                    placeholder="e.g., Computer Science"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text)] mb-2">
                    Year
                  </label>
                  <input
                    type="text"
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                    className="w-full app-input"
                    placeholder="e.g., 3rd Year"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text)] mb-2">
                    Batch
                  </label>
                  <input
                    type="text"
                    value={formData.batch}
                    onChange={(e) => setFormData({ ...formData, batch: e.target.value })}
                    className="w-full app-input"
                    placeholder="e.g., 2024"
                  />
                </div>
              </div>

              {error && (
                <div className="rounded-lg bg-[var(--danger-bg)] border border-[var(--danger)] p-3">
                  <p className="text-sm text-[var(--danger)]">{error}</p>
                </div>
              )}

              <div className="flex gap-3 justify-end pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setShowAddModal(false);
                    setEditingStudent(null);
                    setFormData({ email: "", name: "", studentId: "", phone: "", department: "", year: "", batch: "" });
                  }}
                  className="app-btn-secondary px-6 py-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="app-btn-primary px-6 py-2 disabled:opacity-60"
                >
                  {submitting ? "Saving..." : editingStudent ? "Update" : "Add Student"}
                </button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </Container>
  );
}

