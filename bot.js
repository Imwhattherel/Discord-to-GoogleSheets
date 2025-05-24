
require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder
} = require('discord.js');
const { google } = require('googleapis');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const {
  DISCORD_TOKEN,
  CLIENT_ID,
  GUILD_ID,
  SHEET_ID,
  GOOGLE_APPLICATION_CREDENTIALS: KEYFILE
} = process.env;


const commands = [
  new SlashCommandBuilder()
    .setName('check')
    .setDescription('Look up an item by name (col A)')
    .addStringOption(opt =>
      opt.setName('name')
         .setDescription('Name of the item')
         .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('create')
    .setDescription('Add a new inventory item (cols A–G)')
    .addStringOption(opt => opt.setName('name').setDescription('Name (A)').setRequired(true))
    .addStringOption(opt => opt.setName('description').setDescription('Description (B)').setRequired(true))
    .addStringOption(opt =>
      opt.setName('band')
         .setDescription('Band (C)')
         .setRequired(true)
         .addChoices(
           { name: '7/800', value: '7/800' },
           { name: 'UHF',   value: 'UHF'   },
           { name: 'VHF',   value: 'VHF'   },
           { name: 'All', value: 'All' }
         )
    )
    .addStringOption(opt => opt.setName('model').setDescription('Model Number (D)').setRequired(true))
    .addStringOption(opt => opt.setName('serial').setDescription('Serial Number (E)').setRequired(true))
    .addStringOption(opt => opt.setName('last_inv').setDescription('Last INV date (MM/DD/YYYY) (F)').setRequired(true))
    .addStringOption(opt =>
      opt.setName('status')
         .setDescription('Status (G)')
         .setRequired(true)
         .addChoices(
           { name: 'In Service',          value: 'In Service' },
           { name: 'Broken',              value: 'Broken' },
           { name: 'Sold',       value: 'Sold (Remove)' },
           { name: 'Not in use', value: 'Not in use (acc only)' },
           { name: 'Out Of Service',      value: 'Out Of Service' }
         )
    ),

  new SlashCommandBuilder()
    .setName('change_status')
    .setDescription('Change status by serial number (col E→G)')
    .addStringOption(opt =>
      opt.setName('serial')
         .setDescription('Serial Number of the item')
         .setRequired(true))
    .addStringOption(opt =>
      opt.setName('status')
         .setDescription('New status')
         .setRequired(true)
         .addChoices(
           { name: 'In Service',          value: 'In Service' },
           { name: 'Broken',              value: 'Broken' },
           { name: 'Sold',       value: 'Sold (Remove)' },
           { name: 'Not in use', value: 'Not in use (acc only)' },
           { name: 'Out Of Service',      value: 'Out Of Service' }
         )
    ),

  new SlashCommandBuilder()
    .setName('inventory')
    .setDescription('Set Last INV date for an item (col F)')
    .addStringOption(opt =>
      opt.setName('serial')
         .setDescription('Serial Number of the item')
         .setRequired(true))
    .addStringOption(opt =>
      opt.setName('date')
         .setDescription('Last INV date (MM/DD/YYYY)')
         .setRequired(true)),
].map(cmd => cmd.toJSON());


client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
  try {
    console.log('Registering slash commands…');
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );
    console.log('Slash commands registered');
  } catch (err) {
    console.error('Registration failed:', err);
  }
});


async function getSheets() {
  const auth = new google.auth.GoogleAuth({
    keyFile: KEYFILE,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
  return google.sheets({ version: 'v4', auth: await auth.getClient() });
}


client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const sheets = await getSheets();
  const cmd = interaction.commandName;

  try {
  
    if (cmd === 'check') {
      const name = interaction.options.getString('name');
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: 'Main!A2:G'
      });
      const rows = res.data.values || [];
      const idx  = rows.findIndex(r => r[0] === name);
      if (idx < 0) {
        return interaction.reply({ content: `No item named \`${name}\`.`, ephemeral: true });
      }
      const [a,b,c,d,e,f,g] = rows[idx];
      const embed = new EmbedBuilder()
        .setTitle(`Inventory: ${a}`)
        .addFields(
          { name: 'Description',   value: b||'—', inline: true },
          { name: 'Band',          value: c||'—', inline: true },
          { name: 'Model Number',  value: d||'—', inline: true },
          { name: 'Serial Number', value: e||'—', inline: true },
          { name: 'Last INV',      value: f||'—', inline: true },
          { name: 'Status',        value: g||'—', inline: true },
        );
      return interaction.reply({ embeds: [embed] });
    }


    if (cmd === 'create') {
      const row = [
        interaction.options.getString('name'),
        interaction.options.getString('description'),
        interaction.options.getString('band'),
        interaction.options.getString('model'),
        interaction.options.getString('serial'),
        interaction.options.getString('last_inv'),
        interaction.options.getString('status'),
      ];
      await sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID,
        range: 'Main!A:G',
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [row] }
      });
      return interaction.reply({ content: `Created item \`${row[0]}\`.`, ephemeral: false });
    }


    if (cmd === 'change_status') {
      const serial = interaction.options.getString('serial');
      const status = interaction.options.getString('status');
      const getRes = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: 'Main!E2:E'
      });
      const rows = getRes.data.values || [];
      const idx  = rows.findIndex(r => r[0] === serial);
      if (idx < 0) {
        return interaction.reply({ content: `No item with serial \`${serial}\`.`, ephemeral: true });
      }
      const rowNum = idx + 2;
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `Main!G${rowNum}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[status]] }
      });
      return interaction.reply({ content: `Status for \`${serial}\` set to **${status}**.`, ephemeral: false });
    }

    
    if (cmd === 'inventory') {
      const serial = interaction.options.getString('serial');
      const date   = interaction.options.getString('date');
      await interaction.deferReply();

      const getRes = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: 'Main!E2:E'
      });
      const rows = getRes.data.values || [];
      const idx  = rows.findIndex(r => r[0] === serial);
      if (idx < 0) {
        return interaction.editReply(`No item with serial \`${serial}\`.`);
      }
      const rowNum = idx + 2;
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `Main!F${rowNum}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[date]] }
      });
      return interaction.editReply(`Last INV for \`${serial}\` set to **${date}**.`);
    }

  } catch (err) {
    console.error('Handler error:', err);
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply('Something went wrong.');
    } else {
      await interaction.reply({ content: 'Something went wrong.', ephemeral: true });
    }
  }
});

client.login(DISCORD_TOKEN);
