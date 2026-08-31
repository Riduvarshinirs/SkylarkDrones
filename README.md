# Groundtruth

### Executive Business Intelligence Agent for Skylark Drones

Groundtruth is an executive business intelligence agent for Skylark Drones. It lets leaders ask natural-language questions about sales pipeline health and operational/work-order performance using live monday.com data, then converts the results into concise executive guidance.

This project is designed as an intelligence layer over business data instead of a generic AI chatbot. It retrieves structured data, calculates metrics deterministically, and uses the LLM only to explain the resulting business picture.

## Problem

Business information is often spread across sales and operations workflows, which makes it difficult for decision-makers to quickly understand the current state of the business. In practice, this creates friction when answering questions about:

- pipeline health
- opportunities and deal value
- sector performance
- operational workload
- work-order status and delay risk
- commercial and execution risks

The problem is not just missing information; it is fragmented information that requires manual synthesis before a leader can act.

## Solution

Groundtruth provides a natural-language interface for querying structured business data stored in monday.com. Instead of asking the model to invent or approximate financial results, the application separates the work into two clear layers:

- Deterministic analytics: the code calculates pipeline totals, revenue signals, sector comparisons, operational summaries, and risk flags from normalized source records.
- AI interpretation: the OpenAI model explains the analytics in business language, summarizes the result, and helps generate an executive narrative.

This distinction matters. The LLM is used to interpret and communicate, not to calculate revenue, pipeline value, or work-order risk from raw business data.

## Key Features

Groundtruth currently implements the following capabilities:

- Natural-language business queries
- Live monday.com data integration
- Sales pipeline analytics
- Work-order / operational analytics
- Executive KPI summaries
- Risk detection for deals and delayed work orders
- AI-generated explanation of deterministic results
- Leadership update generation
- Source and data-quality reporting
- Suggested executive questions in the UI

## Example Questions

The interface is designed around practical leadership questions such as:

- How is our pipeline looking?
- What are our biggest opportunities?
- Which sector is strongest?
- What work orders are at risk?
- Compare sales and operations
- Generate a leadership update

These questions align with the implemented intent classification and analytics pipeline in the application.

## Architecture

```text
User
  ↓
Intent Classification
  ↓
Analytics Layer
  ↓
monday.com Data
  ↓
Structured Analytics
  ↓
AI Interpretation
  ↓
Executive Response
```

Each layer has a distinct responsibility:

- User: asks a business question in plain language.
- Intent Classification: determines whether the query is about pipeline, revenue, sectors, risk, work orders, or a leadership summary.
- Analytics Layer: runs deterministic calculations over normalized monday.com records using the logic in the analytics service.
- monday.com Data: provides the source records from the Deals and Work Orders boards.
- Structured Analytics: returns clean, machine-readable metrics, risk flags, and data-quality context.
- AI Interpretation: receives only the structured result and turns it into executive language.
- Executive Response: provides the final answer, key metrics, and caveats in a business-friendly format.

The key reliability principle is that the model never acts as the source of truth for numeric calculations. It explains the numbers already computed by the application and clearly calls out when the underlying data is incomplete or unreliable.

## Data Sources

Groundtruth reads live data from monday.com boards configured through environment variables:

### Deals / Sales Pipeline

The Deals board provides the commercial view of the business. It is used to evaluate:

- deal value and active pipeline
- deal stages and statuses
- close dates and probability
- customer or client identifiers
- sectors and commercial concentration

### Work Orders / Operations

The Work Orders board provides operational execution data. It is used to evaluate:

- work-order status and timing
- queued, ongoing, delayed, and completed work
- operational workload and completion rate
- sector and customer load
- billing and receivable-related operational signals

These are the two primary sources used by the application today. No additional database or warehouse layer is introduced in this repo.

## Tech Stack

This project uses the following technologies that are actually present in the repository:

| Area | Technology |
| --- | --- |
| Application framework | Next.js |
| UI library | React |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Data source integration | monday.com GraphQL API |
| AI layer | OpenAI Chat Completions API |
| Request validation | Zod |

## Project Structure

The repository is organized around a small Next.js application with clearly separated service layers:

- src/app: Next.js app-router entry points, including the API routes and page shell.
- src/components: reusable UI components such as the chat interface, suggested questions, and header.
- src/services/agent: natural-language intent classification, tool planning, and orchestration of the agent flow.
- src/services/analytics: deterministic analytics functions for pipeline, revenue, sectors, risk, and work-order summaries.
- src/services/data: normalization logic that converts raw monday.com records into typed business objects.
- src/services/monday: server-side monday.com API integration and configuration validation.
- src/types/domain.ts: shared domain contracts for deals, work orders, query intent, analytics results, and agent responses.
- src/app/api/chat/route.ts: main conversational API endpoint.
- src/app/api/config-status/route.ts: health/config status endpoint used by the frontend.

## Environment Variables

The application expects the following environment variables to be set on the server:

```bash
MONDAY_API_TOKEN=
MONDAY_DEALS_BOARD_ID=
MONDAY_WORK_ORDERS_BOARD_ID=
OPENAI_API_KEY=
```

These are required for live monday.com access and AI interpretation. Do not commit any real secrets to the repository.

> .env.local must never be committed to GitHub.

For production, configure these values through the deployment platform's environment-variable settings rather than embedding them in source control.

## Local Development

This repository is a standard Next.js app. To run it locally:

```bash
npm install
npm run dev
```

Then open:

```text
http://localhost:3000
```

Optional validation command available in the repo:

```bash
npm run test
```

## Configuration

The monday.com integration is configured through server-side environment variables:

- Monday API token: used to authenticate requests to monday.com
- Deals board ID: identifies the sales pipeline board
- Work Orders board ID: identifies the operational board
- OpenAI API key: enables AI interpretation of the final analytics payload

The app validates these settings before fetching data and returns an explicit error state if required values are missing.

## Deployment

This project is designed for deployment on Vercel as a Next.js application.

1. Connect the GitHub repository to Vercel.
2. Add the required environment variables in the Vercel project settings:
   - MONDAY_API_TOKEN
   - MONDAY_DEALS_BOARD_ID
   - MONDAY_WORK_ORDERS_BOARD_ID
   - OPENAI_API_KEY
3. Deploy the application.
4. If production environment variables change, redeploy the project so the latest values are picked up.

Do not expose secrets in code, logs, or client-visible output.

## Security

Groundtruth follows a simple security model for the data it depends on:

- secrets are stored in environment variables rather than source files
- .env.local is ignored by git and should never be committed
- API credentials remain server-side and are not exposed to the client
- OpenAI and monday.com keys are never included in browser code
- the app explicitly avoids returning secret values in API responses

## Design Philosophy

"Ask the business, not the spreadsheet."

The interface is meant for executives and operators who want answers instead of raw tables. It is intentionally designed around:

- concise answers
- decision-oriented insight
- minimal interface friction
- business context over spreadsheet detail
- transparent grounding in source data and data-quality caveats

## Reliability & Data Accuracy

Groundtruth is built around deterministic data handling. Numeric calculations are performed in the analytics layer from normalized source records, while the AI layer is used primarily for interpretation and communication.

This approach is intentional and benefits reliability:

- missing data is reported instead of guessed
- malformed values are excluded from calculations
- configuration failures are surfaced explicitly
- empty or low-quality result sets return safe fallback responses
- the answer includes data-quality context so the user understands what is reliable and what is not

The system does not claim perfect accuracy; it makes the limits of the source data visible.

## Limitations

The current implementation has important limitations that should be understood by users and reviewers:

- it depends on the quality and completeness of data in monday.com
- historical analysis is limited by the data available on the connected boards
- AI interpretation can still require human validation for important business decisions
- analytics depend on the fields actually present and normalized from the monday.com boards

This is a practical BI agent, not a perfect autonomous analyst. It is designed to be transparent about what it can and cannot infer.

## Future Improvements

The following improvements are realistic future work and are not presented as currently implemented:

- richer historical trend analysis
- additional data sources beyond sales and work-order boards
- configurable executive dashboards
- scheduled leadership report generation
- more advanced anomaly detection
- role-specific business insights and summaries

## Screenshots / Demo

No screenshots or demo assets are checked into this repository at this time.

## Author

Owner / repository metadata currently available from the Git remote:

- GitHub owner: Riduvarshinirs
- Repository: https://github.com/Riduvarshinirs/SkylarkDrones

---

Groundtruth is a focused executive BI assistant for Skylark Drones: it connects live business data to a natural-language workflow, keeps financial calculations deterministic, and helps leaders understand pipeline, operations, and risk without having to manually dig through spreadsheets.
