# Block Diagram Architecture

## System Architecture Overview

This document provides visual representations of the StoreIt system architecture using block diagrams and flowcharts.

---

## 1. High-Level System Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        A[Web Browser]
        B[React Application]
    end
    
    subgraph "BaaS Layer - Supabase"
        C[Auth Service]
        D[Database Service]
        E[RESTful API]
        F[RLS Engine]
    end
    
    subgraph "Data Layer"
        G[(PostgreSQL Database)]
    end
    
    A -->|HTTPS| B
    B -->|Authentication| C
    B -->|Data Requests| E
    C -->|User Context| F
    E -->|Apply RLS| F
    F -->|Query| G
    D -->|Manage| G
```

---

## 2. Three-Tier Architecture

```mermaid
graph LR
    subgraph "Tier 1: Presentation"
        A[React Components]
        B[React Router]
        C[Context API]
    end
    
    subgraph "Tier 2: Backend as a Service"
        D[Supabase Auth]
        E[Supabase Database]
        F[Auto-generated APIs]
    end
    
    subgraph "Tier 3: Data Storage"
        G[(PostgreSQL)]
        H[RLS Policies]
    end
    
    A --> B
    B --> C
    C --> D
    C --> E
    D --> F
    E --> F
    F --> G
    G --> H
```

---

## 3. User Role Hierarchy

```mermaid
graph TD
    A[Org Admin] -->|Creates| B[Departments]
    A -->|Creates| C[Super Admin]
    C -->|Manages| B
    C -->|Creates| D[Classes]
    C -->|Creates| E[Faculty]
    C -->|Creates| F[Students]
    C -->|Assigns| G[Faculty to Classes]
    C -->|Enrolls| H[Students to Classes]
    E -->|Builds| I[Dynamic Forms]
    E -->|Views| J[Student Submissions]
    F -->|Fills| I
```

---

## 4. Authentication Flow

```mermaid
sequenceDiagram
    participant U as User
    participant L as LoginPage
    participant S as Supabase Auth
    participant D as Database
    participant C as AuthContext
    participant R as Dashboard
    
    U->>L: Enter Credentials
    L->>S: signInWithPassword()
    S->>S: Validate Credentials
    S-->>L: JWT Token
    L->>C: Update Auth State
    C->>D: Fetch Profile
    D-->>C: Profile + Role
    C->>C: Store in Context
    C->>R: Redirect to Role Dashboard
    R-->>U: Display Dashboard
```

---

## 5. Component Architecture

```mermaid
graph TB
    subgraph "App.js"
        A[HashRouter]
    end
    
    subgraph "Context Providers"
        B[AuthProvider]
    end
    
    subgraph "Routes"
        C[LoginPage]
        D[OrgAdminDashboard]
        E[SuperAdminDashboard]
        F[FacultyDashboard]
        G[StudentDashboard]
    end
    
    subgraph "Components"
        H[Navbar]
        I[FormBuilder]
        J[FieldRenderer]
        K[Footer]
    end
    
    A --> B
    B --> C
    B --> D
    B --> E
    B --> F
    B --> G
    D --> H
    D --> K
    E --> H
    E --> K
    F --> H
    F --> I
    F --> J
    F --> K
    G --> H
    G --> J
    G --> K
```

---

## 6. Database Schema Relationships

```mermaid
erDiagram
    DEPARTMENTS ||--o{ PROFILES : contains
    DEPARTMENTS ||--o{ CLASSES : contains
    CLASSES ||--o{ CLASS_FACULTY : has
    CLASSES ||--o{ CLASS_STUDENTS : has
    CLASSES ||--o{ STUDENT_SECTIONS : has
    CLASSES ||--o{ FACULTY_SECTIONS : has
    PROFILES ||--o{ CLASS_FACULTY : assigned
    PROFILES ||--o{ CLASS_STUDENTS : enrolled
    STUDENT_SECTIONS ||--o{ STUDENT_SECTION_FIELDS : contains
    FACULTY_SECTIONS ||--o{ FACULTY_SECTION_FIELDS : contains
    STUDENT_SECTION_FIELDS ||--o{ STUDENT_FIELD_VALUES : has
    FACULTY_SECTION_FIELDS ||--o{ FACULTY_FIELD_VALUES : has
    PROFILES ||--o{ STUDENT_FIELD_VALUES : submits
    PROFILES ||--o{ FACULTY_FIELD_VALUES : submits
    
    DEPARTMENTS {
        uuid id PK
        text name
        timestamptz created_at
    }
    
    PROFILES {
        uuid id PK
        text username
        text email
        text full_name
        text role
        uuid department_id FK
        text password
        timestamptz created_at
    }
    
    CLASSES {
        uuid id PK
        text name
        uuid department_id FK
        timestamptz created_at
    }
    
    CLASS_FACULTY {
        uuid id PK
        uuid class_id FK
        uuid faculty_id FK
        timestamptz created_at
    }
    
    CLASS_STUDENTS {
        uuid id PK
        uuid class_id FK
        uuid student_id FK
        timestamptz created_at
    }
    
    STUDENT_SECTIONS {
        uuid id PK
        uuid class_id FK
        text section_name
        int section_order
        uuid created_by FK
        timestamptz created_at
    }
    
    STUDENT_SECTION_FIELDS {
        uuid id PK
        uuid section_id FK
        text field_name
        text field_type
        jsonb field_options
        int field_order
        boolean required
        text upload_link
        timestamptz created_at
    }
    
    STUDENT_FIELD_VALUES {
        uuid id PK
        uuid field_id FK
        uuid student_id FK
        text value
        timestamptz updated_at
    }
```

---

## 7. Form Creation Workflow (Faculty)

```mermaid
flowchart TD
    A[Faculty Logs In] --> B{Select Class}
    B --> C[View Existing Sections]
    C --> D{Action?}
    D -->|Create Section| E[Enter Section Name]
    E --> F[Save Section]
    F --> G[Add Fields to Section]
    G --> H{Field Type?}
    H -->|Text| I[Configure Text Field]
    H -->|Number| J[Configure Number Field]
    H -->|Dropdown| K[Configure Dropdown Options]
    H -->|Date| L[Configure Date Field]
    H -->|Textarea| M[Configure Textarea Field]
    H -->|Link| N[Configure Link Field]
    H -->|Checkbox| O[Configure Checkbox Field]
    I --> P[Set Required Flag]
    J --> P
    K --> P
    L --> P
    M --> P
    N --> P
    O --> P
    P --> Q[Save Field]
    Q --> R{Add More Fields?}
    R -->|Yes| G
    R -->|No| S[Form Created]
    S --> T[Students Can View Form]
```

---

## 8. Form Submission Workflow (Student)

```mermaid
flowchart TD
    A[Student Logs In] --> B[Fetch Assigned Classes]
    B --> C{Has Classes?}
    C -->|No| D[Display: No Class Assigned]
    C -->|Yes| E[Display Class]
    E --> F[Fetch Form Sections & Fields]
    F --> G[Render Dynamic Form]
    G --> H[Student Fills Data]
    H --> I{Submit Click}
    I --> J{Validate Required Fields}
    J -->|Invalid| K[Show Error Messages]
    K --> H
    J -->|Valid| L[Save to Database]
    L --> M[Show Success Message]
    M --> N{Update Data?}
    N -->|Yes| H
    N -->|No| O[End]
```

---

## 9. Data Flow Diagram

```mermaid
graph LR
    subgraph "User Actions"
        A[Login]
        B[Create Data]
        C[Read Data]
        D[Update Data]
        E[Delete Data]
    end
    
    subgraph "Application Layer"
        F[React Components]
        G[AuthContext]
        H[Supabase Client]
    end
    
    subgraph "Security Layer"
        I[JWT Validation]
        J[RLS Policies]
    end
    
    subgraph "Database"
        K[(Tables)]
        L[Triggers]
        M[Functions]
    end
    
    A --> F
    B --> F
    C --> F
    D --> F
    E --> F
    F --> G
    G --> H
    H --> I
    I --> J
    J --> K
    K --> L
    K --> M
```

---

## 10. Cascade Deletion Flow

```mermaid
flowchart TD
    A[Org Admin Deletes Department] --> B[Trigger: ON DELETE CASCADE]
    B --> C[Delete All Profiles in Department]
    C --> D[Delete All Classes in Department]
    D --> E[Delete All Class-Faculty Assignments]
    E --> F[Delete All Class-Student Enrollments]
    F --> G[Delete All Student Sections]
    G --> H[Delete All Faculty Sections]
    H --> I[Delete All Section Fields]
    I --> J[Delete All Field Values]
    J --> K[Deletion Complete]
    K --> L[Database Consistent]
```

---

## 11. Security Architecture

```mermaid
graph TB
    subgraph "Application Security"
        A[Protected Routes]
        B[Role Validation]
        C[Session Management]
    end
    
    subgraph "Transport Security"
        D[HTTPS/TLS]
        E[JWT Tokens]
        F[Secure Headers]
    end
    
    subgraph "Database Security"
        G[Row Level Security]
        H[Department Isolation]
        I[Class Isolation]
        J[User Context auth.uid]
    end
    
    A --> D
    B --> D
    C --> E
    D --> F
    E --> G
    F --> G
    G --> H
    G --> I
    G --> J
```

---

## 12. Deployment Pipeline

```mermaid
flowchart LR
    A[Developer] -->|git push| B[GitHub Repository]
    B -->|Trigger| C[GitHub Actions]
    C -->|npm run build| D[Build React App]
    D -->|Generate| E[Static Files]
    E -->|Deploy| F[GitHub Pages]
    F -->|Serve| G[storeit.fewinfos.com]
    G -->|HTTPS| H[End Users]
```

---

## 13. Multi-Role Access Control

```mermaid
graph TB
    subgraph "Org Admin Access"
        A[Departments] 
        B[Super Admins]
    end
    
    subgraph "Super Admin Access"
        C[Classes]
        D[Faculty]
        E[Students]
        F[Assignments]
    end
    
    subgraph "Faculty Access"
        G[Form Sections]
        H[Form Fields]
        I[Student Submissions]
        J[Faculty-Only Fields]
    end
    
    subgraph "Student Access"
        K[Own Profile]
        L[Assigned Class Forms]
        M[Own Submissions]
    end
    
    A --> C
    B --> C
    C --> G
    D --> G
    F --> I
    E --> L
```

---

## 14. Dynamic Form Structure

```mermaid
graph TD
    A[Class] --> B[Section 1: Personal Info]
    A --> C[Section 2: Academic Info]
    A --> D[Section 3: Contact Info]
    
    B --> E[Field: Full Name - text]
    B --> F[Field: Roll Number - number]
    B --> G[Field: DOB - date]
    
    C --> H[Field: Program - dropdown]
    C --> I[Field: Semester - number]
    C --> J[Field: CGPA - number]
    
    D --> K[Field: Email - text]
    D --> L[Field: Phone - text]
    D --> M[Field: Address - textarea]
```

---

## 15. RLS Policy Enforcement

```mermaid
sequenceDiagram
    participant C as Client
    participant A as Supabase API
    participant R as RLS Engine
    participant D as Database
    
    C->>A: SELECT * FROM profiles
    A->>R: Check User JWT
    R->>R: Extract auth.uid()
    R->>R: Evaluate RLS Policies
    R->>D: Modified Query with WHERE auth.uid() = id
    D-->>R: Filtered Results
    R-->>A: Authorized Data Only
    A-->>C: Response with Allowed Rows
```

---

## 16. Technology Stack Layers

```mermaid
graph TB
    subgraph "Frontend Stack"
        A[React 19]
        B[React Router v6]
        C[Context API]
        D[Plain CSS]
    end
    
    subgraph "BaaS Stack"
        E[Supabase Auth]
        F[Supabase Database]
        G[Supabase JS Client]
    end
    
    subgraph "Database Stack"
        H[PostgreSQL 15+]
        I[RLS Policies]
        J[Triggers & Functions]
    end
    
    subgraph "Hosting Stack"
        K[GitHub Pages]
        L[Custom Domain]
        M[HTTPS/SSL]
    end
    
    A --> E
    B --> E
    C --> G
    G --> F
    F --> H
    H --> I
    A --> K
```

---

## Conclusion

These block diagrams illustrate the comprehensive architecture of StoreIt, demonstrating:

- **Modular Design** - Clear separation of concerns across layers
- **Security-First Approach** - Multiple layers of access control
- **Scalable Structure** - Serverless architecture supports growth
- **Data Integrity** - Cascade deletions maintain consistency
- **User-Centric Workflows** - Role-based functionality flows
- **Modern Technology** - Leveraging current best practices

The visual representations provide stakeholders, developers, and users with clear understanding of system components, data flows, and architectural decisions that make StoreIt an efficient, secure, and maintainable student management solution.
