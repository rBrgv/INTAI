"use client";

import { useState, useEffect, useRef } from "react";
import { Search, Check, Users, X } from "lucide-react";
import Card from "./Card";

type Student = {
  id: string;
  email: string;
  name: string;
  student_id?: string;
  department?: string;
};

type StudentSelectorProps = {
  onSelect: (students: Student[]) => void;
  selectedEmails?: string[];
  multiSelect?: boolean;
};

export default function StudentSelector({ onSelect, selectedEmails = [], multiSelect = true }: StudentSelectorProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set(selectedEmails));
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Close dropdown when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    async function fetchStudents() {
      if (!searchQuery || searchQuery.length < 2) {
        setStudents([]);
        return;
      }

      setLoading(true);
      try {
        const res = await fetch(`/api/college/students?search=${encodeURIComponent(searchQuery)}`);
        const data = await res.json();
        if (res.ok) {
          const responseData = data.data || data;
          setStudents(responseData.students || []);
        }
      } catch (err) {
        console.error("Failed to fetch students:", err);
      } finally {
        setLoading(false);
      }
    }

    const debounce = setTimeout(fetchStudents, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

  const handleSelect = (student: Student) => {
    const newSelected = new Set(selected);
    if (newSelected.has(student.email)) {
      newSelected.delete(student.email);
    } else {
      if (!multiSelect) {
        newSelected.clear();
      }
      newSelected.add(student.email);
    }
    setSelected(newSelected);

    const selectedStudents = students.filter((s) => newSelected.has(s.email));
    onSelect(selectedStudents);

    if (!multiSelect) {
      setShowDropdown(false);
      setSearchQuery("");
    }
  };

  const filteredStudents = students.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.student_id?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
        <input
          type="text"
          placeholder="Search students by name, email, or ID..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setShowDropdown(true);
          }}
          onFocus={() => setShowDropdown(true)}
          className="w-full pl-10 app-input"
        />
        {selected.size > 0 && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <span className="text-xs text-[var(--muted)] bg-[var(--bg)] px-2 py-0.5 rounded">
              {selected.size} selected
            </span>
          </div>
        )}
      </div>

      {showDropdown && searchQuery.length >= 2 && (
        <Card className="absolute z-50 w-full mt-2 max-h-64 overflow-y-auto app-card">
          {loading ? (
            <div className="p-4 text-center text-sm text-[var(--muted)]">Searching...</div>
          ) : filteredStudents.length === 0 ? (
            <div className="p-4 text-center text-sm text-[var(--muted)]">
              No students found. Try a different search.
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {filteredStudents.map((student) => {
                const isSelected = selected.has(student.email);
                return (
                  <button
                    key={student.id}
                    onClick={() => handleSelect(student)}
                    className={`w-full p-3 text-left hover:bg-[var(--bg)] transition-colors ${
                      isSelected ? "bg-blue-50" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-[var(--text)]">{student.name}</p>
                        <p className="text-xs text-[var(--muted)]">{student.email}</p>
                        {student.student_id && (
                          <p className="text-xs text-[var(--muted)]">ID: {student.student_id}</p>
                        )}
                        {student.department && (
                          <p className="text-xs text-[var(--muted)]">{student.department}</p>
                        )}
                      </div>
                      {isSelected && (
                        <Check className="w-5 h-5 text-blue-600 flex-shrink-0 ml-2" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {selected.size > 0 && multiSelect && (
        <div className="mt-2 flex flex-wrap gap-2">
          {students
            .filter((s) => selected.has(s.email))
            .map((student) => (
              <div
                key={student.email}
                className="flex items-center gap-2 bg-blue-50 text-blue-800 px-3 py-1.5 rounded-full text-sm"
              >
                <span>{student.name}</span>
                <button
                  onClick={() => {
                    const newSelected = new Set(selected);
                    newSelected.delete(student.email);
                    setSelected(newSelected);
                    const selectedStudents = students.filter((s) => newSelected.has(s.email));
                    onSelect(selectedStudents);
                  }}
                  className="hover:text-blue-600"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

