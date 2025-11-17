require('dotenv').config();

const { SocketModeClient } = require('@slack/socket-mode');
const { WebClient } = require('@slack/web-api');

const appToken = process.env.SLACK_APP_TOKEN;
const botToken = process.env.SLACK_BOT_TOKEN;

const ical = require('node-ical');
const config = require('./config');

const webClient = new WebClient(botToken);
const socketModeClient = new SocketModeClient({
    appToken,
    webClient
});

async function fetchCalendar() {
    const url = process.env.FACTORIAL_CALENDAR_URL;
    const response = await fetch(url);
    const data = await response.text();
    return ical.sync.parseICS(data);
}

function findThisWeeksEvents(calendarData) {
    const now = new Date();
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
    const endOfWeek = new Date(now.setDate(now.getDate() + 6));

    const eventsThisWeek = [];

    for (const k in calendarData) {
        const event = calendarData[k];
        if (event.type === 'VEVENT') {
            const eventDate = new Date(event.start);
            if (eventDate >= startOfWeek && eventDate <= endOfWeek) {
                eventsThisWeek.push(event);
            }
        }
    }

    return eventsThisWeek;
}

function findNextWeeksEvents(calendarData) {
    const now = new Date();
    const startOfNextWeek = new Date(now.setDate(now.getDate() - now.getDay() + 7));
    const endOfNextWeek = new Date(now.setDate(now.getDate() + 6));

    const eventsNextWeek = [];

    for (const k in calendarData) {
        const event = calendarData[k];
        if (event.type === 'VEVENT') {
            const eventDate = new Date(event.start);
            if (eventDate >= startOfNextWeek && eventDate <= endOfNextWeek) {
                eventsNextWeek.push(event);
            }
        }
    }

    return eventsNextWeek;
}

/**
 * Formats a date as DD/MM
 */
function formatDate(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}`;
}

/**
 * Converts a matcher pattern from config to a regex pattern
 * %s is replaced with a capture group for strings
 * %d is replaced with a capture group for digits
 */
function patternToRegex(pattern) {
    // Escape special regex characters except % placeholders
    let regexPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Replace %s with capturing group for strings (non-greedy)
    regexPattern = regexPattern.replace(/%s/g, '(.+?)');

    // Replace %d with capturing group for digits
    regexPattern = regexPattern.replace(/%d/g, '(\\d+)');

    return new RegExp(`^${regexPattern}$`);
}

/**
 * Extracts data from event summary based on matcher type
 */
function extractEventData(summary, matcherKey, matches) {
    const data = {};

    switch (matcherKey) {
        case 'firstDayAnnouncement':
            data.name = matches[1];
            break;

        case 'birthdayAnnouncement':
            data.name = matches[1];
            break;

        case 'companyAnniversaryAnnouncementFirstYear':
            data.name = matches[1];
            data.years = 1;
            break;

        case 'companyAnniversaryAnnouncementMultipleYears':
            data.years = parseInt(matches[1], 10);
            data.name = matches[2];
            break;

        case 'leaveAnnouncement':
            data.name = matches[1];
            data.days = parseInt(matches[2], 10);
            break;
    }

    return data;
}

/**
 * Organizes events by categories based on config matchers
 * Returns an object with categorized events and extracted data
 */
function organizeEvents(events) {
    const organized = {
        firstDay: [],
        birthdays: [],
        anniversaries: [],
        leaves: [],
        holidays: []
    };

    // Create regex patterns for each matcher
    const matchers = {};
    for (const [key, pattern] of Object.entries(config.matchers)) {
        matchers[key] = patternToRegex(pattern);
    }

    // Categorize each event
    for (const event of events) {
        const summary = event.summary;
        let matched = false;

        // Try to match against each pattern
        for (const [matcherKey, regex] of Object.entries(matchers)) {
            const match = summary.match(regex);

            if (match) {
                matched = true;
                const data = extractEventData(summary, matcherKey, match);
                const eventData = { event, data };

                // Add to appropriate category
                if (matcherKey === 'firstDayAnnouncement') {
                    organized.firstDay.push(eventData);
                } else if (matcherKey === 'birthdayAnnouncement') {
                    organized.birthdays.push(eventData);
                } else if (matcherKey.includes('Anniversary')) {
                    organized.anniversaries.push(eventData);
                } else if (matcherKey === 'leaveAnnouncement') {
                    organized.leaves.push(eventData);
                }

                break; // Stop checking other patterns once we found a match
            }
        }

        // If no matcher found, it's a holiday
        if (!matched) {
            organized.holidays.push({ event, data: {} });
        }
    }

    return organized;
}

(async () => {
    const calendarData = await fetchCalendar();

    for (const k in calendarData) {
        const event = calendarData[k];
        if (event.type === 'VEVENT') {
            console.log(`Event: ${event.summary}, Start: ${event.start}, End: ${event.end}`);
        }
    }

    const eventsThisWeek = findThisWeeksEvents(calendarData);
    const eventsNextWeek = findNextWeeksEvents(calendarData);

    // Organize events by categories
    const organizedThisWeek = organizeEvents(eventsThisWeek);
    const organizedNextWeek = organizeEvents(eventsNextWeek);

    const slackMessage = {
        channel: process.env.SLACK_CHANNEL_ID,
        text: "Aquí tienes el resumen semanal de Orbitant",
        blocks: [{
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": ":calendar: Aquí tienes el resumen semanal de Orbitant"
            }
        }]
    };

    slackMessage.blocks.push({
        "type": "divider"
    });

    slackMessage.blocks.push({
        "type": "section",
        "fields": [
            {
                "type": "mrkdwn",
                "text": "*Eventos de esta semana:*"
            }
        ]
    });

    // Example: Display organized events
    console.log('\n=== Events This Week ===');
    if (organizedThisWeek.firstDay.length > 0) {

        slackMessage.blocks.push({
            "type": "section",
            "fields": [
                {
                    "type": "mrkdwn",
                    "text": ":new: *Nuevas incorporaciones:*"
                }
            ]
        });

        console.log('\nFirst Days:');
        const firstDayTexts = [];
        organizedThisWeek.firstDay.forEach(({ event, data }) => {
            const text = `  - ${data.name} (${formatDate(event.start)})`;
            firstDayTexts.push(text);
            console.log(text);
        });

        slackMessage.blocks.push({
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": firstDayTexts.join('\n')
            }
        });
    }

    if (organizedThisWeek.birthdays.length > 0) {

        slackMessage.blocks.push({
            "type": "section",
            "fields": [
                {
                    "type": "mrkdwn",
                    "text": ":partying_face: *Cumpleaños:*"
                }
            ]
        });

        console.log('\nBirthdays:');
        const birthdayTexts = [];
        organizedThisWeek.birthdays.forEach(({ event, data }) => {
            const text = ` - ${data.name} (${formatDate(event.start)})`;
            birthdayTexts.push(text);
            console.log(text);
        });

        slackMessage.blocks.push({
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": birthdayTexts.join('\n')
            }
        });
    }

    if (organizedThisWeek.anniversaries.length > 0) {
        slackMessage.blocks.push({
            "type": "section",
            "fields": [
                {
                    "type": "mrkdwn",
                    "text": ":tada: *Aniversarios de empresa:*"
                }
            ]
        });
        console.log('\nAnniversaries:');
        anniversariesTexts = [];
        organizedThisWeek.anniversaries.forEach(({ event, data }) => {
            anniversariesTexts.push(`  - ${data.name} - ${data.years} año(s) (${formatDate(event.start)})`);
            console.log(`  - ${data.name} - ${data.years} year(s) (${formatDate(event.start)})`);
        });

        slackMessage.blocks.push({
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": anniversariesTexts.join('\n')
            }
        });

    }
    if (organizedThisWeek.leaves.length > 0) {

        slackMessage.blocks.push({
            "type": "section",
            "fields": [
                {
                    "type": "mrkdwn",
                    "text": ":palm_tree: *Ausencias:*"
                }
            ]
        });

        console.log('\nLeaves:');
        const leaveTexts = [];
        organizedThisWeek.leaves.forEach(({ event, data }) => {
            leaveTexts.push(`  - ${data.name} - ${data.days} día(s) (${formatDate(event.start)})`);
            console.log(`  - ${data.name} - ${data.days} día(s) (${formatDate(event.start)})`);
        });

        slackMessage.blocks.push({
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": leaveTexts.join('\n')
            }
        });

    }
    if (organizedThisWeek.holidays.length > 0) {

        slackMessage.blocks.push({
            "type": "section",
            "fields": [
                {
                    "type": "mrkdwn",
                    "text": ":luffy-wooho: *Días festivos:*"
                }
            ]
        });

        console.log('\nHolidays:');

        const holidayTexts = [];

        organizedThisWeek.holidays.forEach(({ event }) => {
            holidayTexts.push(`  - ${event.summary} (${formatDate(event.start)})`);
            console.log(`  - ${event.summary} (${formatDate(event.start)})`);

        });

        slackMessage.blocks.push({
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": holidayTexts.join('\n')
            }
        });
    }

    console.log('\n=== Events Next Week ===');
    if (organizedNextWeek.firstDay.length > 0) {
        console.log('\nFirst Days:');
        organizedNextWeek.firstDay.forEach(({ event, data }) => {
            console.log(`  - ${data.name} (${formatDate(event.start)})`);
        });
    }
    if (organizedNextWeek.birthdays.length > 0) {
        console.log('\nBirthdays:');
        organizedNextWeek.birthdays.forEach(({ event, data }) => {
            console.log(`  - ${data.name} (${formatDate(event.start)})`);
        });
    }
    if (organizedNextWeek.anniversaries.length > 0) {
        console.log('\nAnniversaries:');
        organizedNextWeek.anniversaries.forEach(({ event, data }) => {
            console.log(`  - ${data.name} - ${data.years} year(s) (${formatDate(event.start)})`);
        });
    }
    if (organizedNextWeek.leaves.length > 0) {
        console.log('\nLeaves:');
        organizedNextWeek.leaves.forEach(({ event, data }) => {
            console.log(`  - ${data.name} - ${data.days} day(s) (${formatDate(event.start)})`);
        });
    }
    if (organizedNextWeek.holidays.length > 0) {
        slackMessage.blocks.push({ type: "divider" });
        slackMessage.blocks.push({
            "type": "section",
            "fields": [
                {
                    "type": "mrkdwn",
                    "text": ":homer-whoohoo: *Días festivos para la próxima semana:*"
                }
            ]
        });

        const nextWeekHolidayTexts = [];

        organizedNextWeek.holidays.forEach(({ event }) => {
            nextWeekHolidayTexts.push(`  - ${event.summary} (${formatDate(event.start)})`);
        });

        slackMessage.blocks.push({
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": nextWeekHolidayTexts.join('\n')
            }
        });

        console.log('\nHolidays:');
        organizedNextWeek.holidays.forEach(({ event }) => {
            console.log(`  - ${event.summary} (${formatDate(event.start)})`);
        });
    }

    // Connect to Slack
    await socketModeClient.start();

    try {
        // Post the message
        const result = await webClient.chat.postMessage(slackMessage);
        console.log(`Message has been sent`);

        // Clean up and exit

        await socketModeClient.disconnect();
        process.exit(0);

    } catch (error) {
        console.error(`Error sending message: ${error}`);
        await socketModeClient.disconnect();
        process.exit(1);
    }
})();