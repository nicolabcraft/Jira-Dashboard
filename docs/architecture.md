# Application Architecture

This document outlines the architecture of the Jira Dashboard application.

## Architecture Diagram

```mermaid
graph TD
    subgraph "User's Browser"
        A[Frontend - HTML/CSS/JS]
    end

    subgraph "Web Server"
        B[Backend - Flask API]
    end

    subgraph "Database"
        C[MongoDB Atlas]
    end

    subgraph "External Services"
        D[Jira API]
        E[Google OAuth]
    end

    A -- "API Requests (fetch)" --> B
    B -- "Serves Static Files" --> A
    B -- "Reads/Writes Data" --> C
    B -- "Fetches Ticket Data" --> D
    B -- "Authenticates Users" --> E
    E -- "Redirects User" --> A
```

## Summary of the Architecture

*   The **Frontend** is a single-page application that communicates with the backend via API calls to fetch data and render it using Chart.js.
*   The **Backend** is a Flask application that exposes a REST API, connects to a MongoDB database, and integrates with the Jira API for data and Google for authentication.
*   **MongoDB** stores user information, session data, and cached statistics from Jira.
*   **Jira** is the source of truth for all ticket-related data.
*   **Google OAuth** provides a secure way for users to log in.