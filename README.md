# Factorial Calendar Slack

A Slack bot that announces weekly events from Factorial calendar, including birthdays, anniversaries, leaves, holidays, and new employee first days.

## Features

- **New Employee Announcements**: Welcomes new team members on their first day
- **Birthday Notifications**: Celebrates team member birthdays
- **Company Anniversary Reminders**: Recognizes employees' work anniversaries
- **Leave Notifications**: Informs about team members on leave
- **Holiday Announcements**: Displays public holidays

## Prerequisites

- Node.js (v14 or higher recommended)
- A Slack workspace with admin permissions
- Factorial account with calendar access

## Installation

1. Clone the repository:
```bash
git clone https://github.com/weorbitant/factorial-calendar-slack.git
cd factorial-calendar-slack
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file based on `.env.example`:
```bash
cp .env.example .env
```

4. Configure your environment variables (see Configuration section below)

## Configuration

### Slack App Setup

1. Go to [Slack API Apps](https://api.slack.com/apps)
2. Create a new app or select an existing one
3. Enable Socket Mode:
   - Go to "Socket Mode" in the sidebar
   - Enable Socket Mode
   - Generate an App-Level Token with `connections:write` scope
   - Copy the token (starts with `xapp-`) to `SLACK_APP_TOKEN`

4. Configure OAuth & Permissions:
   - Go to "OAuth & Permissions" in the sidebar
   - Add the following Bot Token Scopes:
     - `chat:write`
     - `channels:read`
   - Install the app to your workspace
   - Copy the Bot User OAuth Token (starts with `xoxb-`) to `SLACK_BOT_TOKEN`

5. Get your channel ID:
   - Right-click on the target Slack channel
   - Select "View channel details"
   - Copy the Channel ID from the bottom of the modal
   - Add it to `SLACK_CHANNEL_ID`

### Factorial Calendar Setup

1. Log in to your Factorial account
2. Navigate to the calendar section
3. Find the calendar export/subscription option
4. Copy the iCal feed URL (should end with `.ics`)
5. Add the URL to `FACTORIAL_CALENDAR_URL` in your `.env` file

### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `SLACK_APP_TOKEN` | Slack App-Level Token | `xapp-1-XXXXXXXXXXXXX-...` |
| `SLACK_BOT_TOKEN` | Slack Bot User OAuth Token | `xoxb-XXXXXXXXXXXXX-...` |
| `SLACK_CHANNEL_ID` | Target Slack channel ID | `C01XXXXXXXX` |
| `FACTORIAL_CALENDAR_URL` | Factorial calendar iCal feed URL | `https://api.factorialhr.com/calendars/...` |

## Usage

Run the application:
```bash
node app.js
```

The bot will:
1. Fetch events from the Factorial calendar
2. Organize events by category
3. Post a formatted message to the configured Slack channel

### Event Matchers

The bot categorizes events based on patterns defined in `config.js`:

- **First Day**: `"Primer día de %s en la empresa"`
- **Birthday**: `"🎉 Cumpleaños de %s"`
- **1st Anniversary**: `"🎉 Primer aniversario de %s en la empresa"`
- **Multiple Years Anniversary**: `"🎉 %d aniversario de %s en la empresa"`
- **Leave**: `"%s: ausente durante %d días"`
- **Holidays**: Any event that doesn't match the above patterns

You can customize these patterns in the `config.js` file to match your Factorial calendar event naming conventions.

## Project Structure

```
factorial-calendar-slack/
├── app.js           # Main application logic
├── config.js        # Event matcher patterns configuration
├── package.json     # Project dependencies and metadata
├── .env            # Environment variables (not in repo)
├── .env.example    # Environment variables template
└── README.md       # This file
```

## How It Works

1. **Calendar Fetching**: The app fetches the iCal feed from Factorial using `node-ical`
2. **Event Processing**: Events are filtered for the current and next week
3. **Categorization**: Events are organized by type using regex pattern matching
4. **Slack Integration**: A formatted message is sent to Slack using the Web API and Socket Mode

### Functions Overview

- `fetchCalendar()`: Retrieves and parses the Factorial calendar
- `findThisWeeksEvents()`: Filters events for the current week
- `findNextWeeksEvents()`: Filters events for the next week
- `organizeEvents()`: Categorizes events based on config matchers
- `patternToRegex()`: Converts config patterns to regex (supports `%s` for strings, `%d` for digits)
- `extractEventData()`: Extracts relevant data (names, years, days) from event summaries

## Scheduling

To run this bot automatically on a schedule, consider using:

- **Cron jobs** (Linux/Mac):
  ```bash
  # Run every Monday at 9 AM
  0 9 * * 1 cd /path/to/factorial-calendar-slack && node app.js
  ```

- **Task Scheduler** (Windows)
- **Cloud schedulers**: AWS EventBridge, Google Cloud Scheduler, Azure Logic Apps
- **Process managers**: PM2 with cron mode

## Troubleshooting

### Common Issues

1. **Bot not posting messages**:
   - Verify the bot is invited to the target channel
   - Check that `SLACK_CHANNEL_ID` is correct
   - Ensure bot has `chat:write` permission

2. **Calendar not loading**:
   - Verify `FACTORIAL_CALENDAR_URL` is accessible
   - Check if the URL requires authentication
   - Ensure the URL points to a valid `.ics` file

3. **Events not being categorized**:
   - Review event summaries in Factorial
   - Adjust patterns in `config.js` to match your event naming
   - Check console output for unmatched events

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

ISC

## Author

Jose Vicente Giner (GentooXativa)

## Support

For issues and questions, please open an issue at:
https://github.com/weorbitant/factorial-calendar-slack/issues
