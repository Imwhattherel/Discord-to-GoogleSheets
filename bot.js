require('dotenv').config();
const { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, REST, Routes } = require('discord.js');
const { google } = require('googleapis');


if (!process.env.DISCORD_TOKEN) console.error('Missing DISCORD_TOKEN in .env');
const client = new Client({ intents: [GatewayIntentBits.Guilds] });


const auth = new google.auth.GoogleAuth({
  keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheetsAPI = google.sheets({ version: 'v4', auth });
const SHEET_ID = process.env.SHEET_ID;
const SHEET_NAME = 'Main';


async function mainAsync() {
  const commands = [
    new SlashCommandBuilder()
      .setName('check')
      .setDescription('Check an item in inventory')
      .addStringOption(opt => opt.setName('item').setDescription('Item name (column A)').setRequired(true)),
    new SlashCommandBuilder()
      .setName('create')
      .setDescription('Create a new inventory item')
      .addStringOption(opt => opt.setName('name').setDescription('Name (column A)').setRequired(true))
      .addStringOption(opt => opt.setName('description').setDescription('Description (column B)').setRequired(true))
      .addStringOption(opt => opt.setName('band').setDescription('Band (column C)').setRequired(true))
      .addStringOption(opt => opt.setName('model_number').setDescription('Model Number (column D)').setRequired(true))
      .addStringOption(opt => opt.setName('serial_number').setDescription('Serial Number (column E)').setRequired(true))
      .addStringOption(opt => opt.setName('last_inv').setDescription('Last INV date (column F)').setRequired(true))
      .addStringOption(opt => opt.setName('status').setDescription('Status (column G)').setRequired(true)),
  ].map(cmd => cmd.toJSON());

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );
    console.log('Registered slash commands.');
  } catch (err) {
    console.error('Error registering commands:', err);
  }
}

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
  mainAsync();
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, options } = interaction;

  if (commandName === 'check') {
    const itemName = options.getString('item');
    await interaction.deferReply();
    try {
      const res = await sheetsAPI.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: `${SHEET_NAME}!A2:G`,
      });
      const rows = res.data.values || [];
      const row = rows.find(r => r[0] === itemName);
      if (!row) {
        return interaction.editReply(`Item **${itemName}** not found.`);
      }

      const embed = new EmbedBuilder()
        .setTitle(`Inventory: ${row[0]}`)
        .addFields(
          { name: 'Description', value: row[1] || '-' },
          { name: 'Band', value: row[2] || '-' },
          { name: 'Model Number', value: row[3] || '-' },
          { name: 'Serial Number', value: row[4] || '-' },
          { name: 'Last INV', value: row[5] || '-' },
          { name: 'Status', value: row[6] || '-' }
        );

      interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error(err);
      interaction.editReply('Error reading sheet.');
    }
  }

  else if (commandName === 'create') {
    const values = [
      options.getString('name'),
      options.getString('description'),
      options.getString('band'),
      options.getString('model_number'),
      options.getString('serial_number'),
      options.getString('last_inv'),
      options.getString('status'),
    ];
    await interaction.deferReply({ ephemeral: true });
    try {
      await sheetsAPI.spreadsheets.values.append({
        spreadsheetId: SHEET_ID,
        range: `${SHEET_NAME}!A2:G2`,
        valueInputOption: 'RAW',
        resource: { values: [values] },
      });
      interaction.editReply(`Created item **${values[0]}** successfully.`);
    } catch (err) {
      console.error(err);
      interaction.editReply('Error writing to sheet.');
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
