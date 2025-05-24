# Discord-Google Sheets Bot

This guide walks you through setting up and running the Discord bot that integrates with Google Sheets for inventory management.

---

## 1. Copy the Template Google Sheet

A preformatted sheet is provided. Copy it into your own Drive:

> [📄 Copy the Inventory Template Sheet](https://docs.google.com/spreadsheets/d/1bbQwaMMT2-2YXjimdhVuQO0qk5qeD9YfWHlZN9HM1Ms/edit?usp=sharing/copy)


---

## 2. Enable Google Sheets API & Create Service Account

1. Go to the [Google Cloud Console API Library](https://console.cloud.google.com/apis/library/sheets.googleapis.com) and **Enable** the Sheets API.  
2. Navigate to **APIs & Services > Credentials**.  
3. **Create Service Account**, grant it the **Editor** role.  
4. **Create key** (JSON) and download it. (rename this to  my-service-account.json)
5. Share your copied sheet with the service account’s email (found in the JSON under `client_email`).
6. Fill out the .env with your bot and sheet information
   

---

### Starting the Bot

run npm install
node bot.js
