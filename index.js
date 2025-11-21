const {
    Client,
    GatewayIntentBits,
    Partials,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
} = require("discord.js");
require("dotenv").config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ],
});

// 닉네임 제출 후 지급할 역할 ID
const REWARD_ROLE = "1441427004112244858";

// 적용 제외 역할 (optional)
const EXCLUDED = ["@everyone"];

client.on("ready", () => {
    console.log(`${client.user.tag} 로그인 완료`);
});


// ------------------------------------------------------
// 1) !닉네임 명령어
// ------------------------------------------------------
client.on("messageCreate", async (msg) => {
    if (msg.author.bot) return;
    if (!msg.content.startsWith("!닉네임")) return;

    const embed = new EmbedBuilder()
        .setTitle("<:crown:1441426161589551135> 𝑨𝑰𝑶𝑵2 나비 레기온 게임 닉네임을 작성해주세요!")
        .setDescription(
            "𝑨𝑰𝑶𝑵2 나비 레기온 커뮤니티에 오신 것을 환영합니다!\n닉네임을 작성하시고 활동해주세요!"
        )
        .setColor("#FFD700");

    const button = new ButtonBuilder()
        .setCustomId("nickname_open")
        .setLabel("닉네임 작성하기")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("<:crown:1441426161589551135>");

    const row = new ActionRowBuilder().addComponents(button);

    msg.channel.send({ embeds: [embed], components: [row] });
});


// ------------------------------------------------------
// 2) 닉네임 작성 버튼 클릭 → 모달 띄우기
// ------------------------------------------------------
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isButton()) return;
    if (interaction.customId !== "nickname_open") return;

    const modal = new ModalBuilder()
        .setCustomId("nickname_modal")
        .setTitle("AION2 닉네임을 작성해주세요.");

    const nicknameInput = new TextInputBuilder()
        .setCustomId("nickname_input")
        .setLabel("게임 닉네임 (필수)")
        .setPlaceholder("예: damhxun")
        .setRequired(true)
        .setStyle(TextInputStyle.Short);

    const row = new ActionRowBuilder().addComponents(nicknameInput);
    modal.addComponents(row);

    await interaction.showModal(modal);
});


// ------------------------------------------------------
// 3) 모달 제출 → 닉네임 변경 + 역할 지급
// ------------------------------------------------------
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isModalSubmit()) return;
    if (interaction.customId !== "nickname_modal") return;

    const inputNickname = interaction.fields.getTextInputValue("nickname_input");
    const member = interaction.member;

    // 유저의 가장 높은 역할 찾기 (제외 목록 제거)
    const topRole = member.roles.cache
        .filter((r) => !EXCLUDED.includes(r.name))
        .sort((a, b) => b.position - a.position)
        .first();

    const roleName = topRole ? topRole.name : "회원";

    const finalNickname = `[${roleName}] ${inputNickname}`;

    // 닉네임 변경
    try {
        await member.setNickname(finalNickname);
    } catch (e) {
        console.log("닉네임 변경 실패:", e.message);
    }

    // 보상 역할 지급
    try {
        const rewardRole = interaction.guild.roles.cache.get(REWARD_ROLE);
        if (rewardRole && !member.roles.cache.has(REWARD_ROLE)) {
            await member.roles.add(REWARD_ROLE);
        }
    } catch (e) {
        console.log("역할 지급 오류:", e.message);
    }

    await interaction.reply({
        content: `닉네임이 **${finalNickname}** 으로 설정되었습니다!`,
        ephemeral: true,
    });
});

client.login(process.env.TOKEN);
