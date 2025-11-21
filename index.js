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
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel],
});

// 설정 값들
const REWARD_ROLE = "1441427004112244858";  // 인증 역할 ID
const LOG_CHANNEL_ID = "로그채널ID를여기에"; // 입장/퇴장 로그 보낼 채널 ID
const TIMEOUT_DURATION = 60 * 1000; // 1분 타임아웃
const MAX_WARN = 10; // 안내 메시지 10회 후 제재

// 상태 저장용 맵
const warnCount = new Map(); // userId -> 경고 수
const welcomeDMs = new Map(); // userId -> { channelId, messageId }

client.on("ready", () => {
  console.log(`${client.user.tag} 로그인 완료`);
});

// ==================================================
// 입장 로그
// ==================================================
client.on("guildMemberAdd", async (member) => {
  console.log("👋 멤버 입장:", member.user.tag);

  const logChannel = member.guild.channels.cache.get(LOG_CHANNEL_ID);
  if (!logChannel) {
    console.log("❌ 로그 채널을 찾을 수 없음 (입장)");
  } else {
    const embed = new EmbedBuilder()
      .setTitle("멤버가 입장했습니다!")
      .setColor("#00bcd4")
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: "유저", value: `${member.user}`, inline: true },
        { name: "입장 시간", value: `<t:${Math.floor(Date.now() / 1000)}:F>` }
      );
    await logChannel.send({ embeds: [embed] });
  }

  // 환영 DM + 인증 안내
  try {
    const dm = await member.send({
      content: `👋🏻 <@${member.id}> 님, 𝑨𝑰𝑶𝑵2 루드라 방물에 오신 것을 환영합니다!\n\n𝑨𝑰𝑶𝑵2 루드라에서는 관련 규칙에 따라 게임 닉네임을 입력하셔야 채팅창에 메시지를 보낼 수 있어요! 꼭 작성 후 이용해주세요~!\n\n닉네임 설정하러 가기: https://discordapp.com/channels/1441355433473347596/1441453871472967791`
    });

    welcomeDMs.set(member.id, {
      channelId: dm.channel.id,
      messageId: dm.id,
    });
  } catch (e) {
    console.error("가입시 DM 전송 실패:", e);
  }
});

// ==================================================
// 퇴장 로그
// ==================================================
client.on("guildMemberRemove", async (member) => {
  console.log("❌ 멤버 퇴장:", member.user.tag);

  const logChannel = member.guild.channels.cache.get(LOG_CHANNEL_ID);
  if (!logChannel) {
    console.log("❌ 로그 채널을 찾을 수 없음 (퇴장)");
  } else {
    const embed = new EmbedBuilder()
      .setTitle("멤버가 퇴장했습니다.")
      .setColor("#d91e18")
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: "유저", value: `${member.user}`, inline: true },
        { name: "퇴장 시간", value: `<t:${Math.floor(Date.now() / 1000)}:F>` }
      );
    await logChannel.send({ embeds: [embed] });
  }

  // 퇴장 시에 DM 저장 기록 정리
  if (welcomeDMs.has(member.id)) {
    welcomeDMs.delete(member.id);
  }
});

// ==================================================
// 닉네임 인증: 명령 / 버튼 / 모달
// ==================================================
client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;
  if (!msg.content.startsWith("!닉네임")) return;

  const embed = new EmbedBuilder()
    .setTitle("<:crown:1441426161589551135> 𝑨𝑰𝑶𝑵2 게임 닉네임을 작성해주세요!")
    .setDescription("𝑨𝑰𝑶𝑵2 게임 커뮤니티에 오신 것을 환영합니다!\n닉네임을 작성하시고 활동해주세요!")
    .setColor("#FFD700");

  const button = new ButtonBuilder()
    .setCustomId("nickname_open")
    .setLabel("닉네임 작성하기")
    .setStyle(ButtonStyle.Primary)
    .setEmoji("<:crown:1441426161589551135>");

  const row = new ActionRowBuilder().addComponents(button);

  await msg.channel.send({ embeds: [embed], components: [row] });
});

client.on("interactionCreate", async (interaction) => {
  // 버튼 클릭해서 모달 열기
  if (interaction.isButton() && interaction.customId === "nickname_open") {
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
    return;
  }

  // 모달 제출 처리
  if (interaction.isModalSubmit() && interaction.customId === "nickname_modal") {
    const inputNickname = interaction.fields.getTextInputValue("nickname_input");
    const member = interaction.member;

    // 가장 상위 역할 이름 구해서 닉네임에 붙이기
    const topRole = member.roles.cache
      .filter((r) => r.name !== "@everyone")
      .sort((a, b) => b.position - a.position)
      .first();
    const roleName = topRole ? topRole.name : "회원";
    const finalNickname = `[${roleName}] ${inputNickname}`;

    // 닉네임 변경
    try {
      await member.setNickname(finalNickname);
    } catch (e) {
      console.error("닉네임 변경 실패:", e);
    }

    // 인증 역할 부여
    try {
      const role = interaction.guild.roles.cache.get(REWARD_ROLE);
      if (role && !member.roles.cache.has(REWARD_ROLE)) {
        await member.roles.add(role);
      }
    } catch (e) {
      console.error("역할 지급 오류:", e);
    }

    // 응답
    await interaction.reply({
      content: `닉네임이 **${finalNickname}** 으로 설정되었고, 역할이 지급되었습니다!`,
      ephemeral: true,
    });

    // 역할 생기면 기존 DM 안내 삭제 시도
    const dmInfo = welcomeDMs.get(member.id);
    if (dmInfo) {
      try {
        const dmChannel = await client.channels.fetch(dmInfo.channelId);
        const dmMsg = await dmChannel.messages.fetch(dmInfo.messageId);
        await dmMsg.delete();
        welcomeDMs.delete(member.id);
      } catch (e) {
        console.error("DM 안내 메시지 삭제 실패:", e);
      }
    }
  }
});

// ==================================================
// 24시간마다 역할 없는 유저에게 DM 반복 + 삭제 관리
// ==================================================
setInterval(async () => {
  for (const guild of client.guilds.cache.values()) {
    await guild.members.fetch();

    for (const member of guild.members.cache.values()) {
      if (member.user.bot) continue;

      const hasRole = member.roles.cache.has(REWARD_ROLE);
      const dmInfo = welcomeDMs.get(member.id);

      if (!hasRole) {
        if (!dmInfo) {
          try {
            const dm = await member.send({
              content: `👋🏻 <@${member.id}> 님, 𝑨𝑰𝑶𝑵2 루드라 방물에 오신 것을 환영합니다!\n\n𝑨𝑰𝑶𝑵2 루드라에서는 관련 규칙에 따라 게임 닉네임을 입력하셔야 채팅창에 메시지를 보낼 수 있어요! 꼭 작성 후 이용해주세요~!\n\n닉네임 설정하러 가기: https://discordapp.com/channels/1441355433473347596/1441453871472967791`
            });
            welcomeDMs.set(member.id, {
              channelId: dm.channel.id,
              messageId: dm.id,
            });
          } catch (e) {
            console.error("24시간 체크 중 DM 실패:", e);
          }
        }
      } else {
        if (dmInfo) {
          try {
            const dmChannel = await client.channels.fetch(dmInfo.channelId);
            const dmMsg = await dmChannel.messages.fetch(dmInfo.messageId);
            await dmMsg.delete();
          } catch (e) {
            console.error("DM 삭제 실패 (스케줄):", e);
          }
          welcomeDMs.delete(member.id);
        }
      }
    }
  }
}, 24 * 60 * 60 * 1000);

// ==================================================
// 사용자가 역할 없이 메시지 보내면 삭제 + 안내 + 타임아웃
// ==================================================
client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;
  const member = msg.member;
  if (!member) return;

  const hasRole = member.roles.cache.has(REWARD_ROLE);
  if (!hasRole) {
    // 삭제
    try {
      await msg.delete();
    } catch (e) {
      console.error("메시지 삭제 실패:", e);
    }

    // 경고 증가
    const prev = warnCount.get(member.id) ?? 0;
    const next = prev + 1;
    warnCount.set(member.id, next);

    // 안내 임베드
    const embed = new EmbedBuilder()
      .setTitle("닉네임 인증을 해주세요.")
      .setDescription(`<@${member.id}>님, 닉네임을 작성하시면 모든 서비스를 이용하실 수 있어요. 인증 후 이용해주세요!`)
      .setColor("#FFD700");

    try {
      const sent = await msg.channel.send({ embeds: [embed] });
      setTimeout(() => {
        sent.delete().catch((e) => console.error("안내 메시지 삭제 실패:", e));
      }, 10 * 1000);
    } catch (e) {
      console.error("안내 메시지 전송 실패:", e);
    }

    // 경고 너무 쌓이면 타임아웃
    if (next >= MAX_WARN) {
      try {
        await member.timeout(TIMEOUT_DURATION, "닉네임 인증 누락 및 스팸");
        warnCount.set(member.id, 0);
      } catch (e) {
        console.error("타임아웃 실패:", e);
      }
    }
  }
});

// ==================================================
// 웹 서비스용 포트 (헬스체크 등)
// ==================================================
const http = require("http");
const PORT = process.env.PORT || 3000;

http
  .createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Bot is running!");
  })
  .listen(PORT, () => {
    console.log(`Web server running on port ${PORT}`);
  });

client.login(process.env.TOKEN);

    console.log(`Web server running on port ${PORT}`);
});

