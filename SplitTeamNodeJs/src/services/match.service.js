const _ = require("lodash");
const db = require("../../models");
const { match, team, user } = require("../../models");
const { Op } = require("sequelize");
const { calculateMatch } = require("../shared/common");
const { responseError } = require("../shared/handleError");

const MatchService = {};

MatchService.getMatchs = async (search) => {
  return await match.findAll({
    include: [
      {
        model: team,
        attributes: { exclude: ["match_id"] },
        include: [{ model: user, through: { attributes: [] } }],
      },
    ],
    where: {
      status: {
        [Op.eq]: "active",
      },
      name: {
        [Op.iLike]: `%${search ? search : ""}%`,
      },
    },
    order: [["createdAt", "ASC"]],
  });
};

MatchService.getMatchById = async (id) => {
  return await match.findOne({
    include: [
      {
        model: team,
        attributes: { exclude: ["match_id"] },
        include: [{ model: user, through: { attributes: [] } }],
      },
    ],
    where: { status: "active", id: id },
  });
};

MatchService.generateTeam = async (listUser) => {
  const listMatchUsers = await user.findAll({
    include: [
      {
        model: team,
        where: { status: "active" },
        through: { attributes: [] },
        required: false,
      },
    ],
    where: { status: "active", id: listUser },
  });
  const teamSplit = {
    amountWinRateCT: 0,
    amountWinRateT: 0,
    teamCT: [],
    teamT: [],
  };
  const listFind = listMatchUsers.map((x) => x.get({ plain: true }));
  const listSort = calculateMatch(listFind).sort(
    (a, b) => b.winRate - a.winRate
  );
  _(listSort).forEach((item) => {
    if (teamSplit.amountWinRateT === teamSplit.amountWinRateCT) {
      if (teamSplit.teamT.length > teamSplit.teamCT.length) {
        teamSplit.teamCT.push(item);
        teamSplit.amountWinRateCT += +item.winRate;
      } else if (teamSplit.teamT.length < teamSplit.teamCT.length) {
        teamSplit.teamT.push(item);
        teamSplit.amountWinRateT += +item.winRate;
      } else {
        const random = Math.floor(Math.random() * 2);
        if (random > 0) {
          teamSplit.teamT.push(item);
          teamSplit.amountWinRateT += +item.winRate;
        } else {
          teamSplit.teamCT.push(item);
          teamSplit.amountWinRateCT += +item.winRate;
        }
      }
    } else {
      if (teamSplit.amountWinRateT > teamSplit.amountWinRateCT) {
        teamSplit.teamCT.push(item);
        teamSplit.amountWinRateCT += +item.winRate;
      } else {
        teamSplit.teamT.push(item);
        teamSplit.amountWinRateT += +item.winRate;
      }
    }
  });
  return teamSplit;
};

MatchService.createMatch = async (name, description, teamCT, teamT) => {
  const t = await db.sequelize.transaction();
  try {
    //create transaction insert into multiple table (matches,team,users)
    const getDateNow = new Date().toISOString();
    const [matchCreate, created] = await match.findOrCreate({
      where: { name: name.trim() + getDateNow },
      defaults: {
        name: name + " " + getDateNow,
        state: "INPROGRESS",
        description: description,
        createdAt: getDateNow,
      },
      transaction: t,
    });
    if (!created) {
      await t.rollback();
      return responseError("Match name already exists in the system", 400);
    }
    const teamCreate = await team.bulkCreate(
      [
        {
          team_type: "CT",
          result: "PENDING",
          match_id: matchCreate.id,
        },
        {
          team_type: "T",
          result: "PENDING",
          match_id: matchCreate.id,
        },
      ],
      { transaction: t }
    );
    if (!teamCreate) {
      await t.rollback();
      return responseError("Cannot create team for match", 500);
    }
    for (const team of teamCreate) {
      if (team.getDataValue("team_type") === "T") {
        await team.addUser(teamT, { transaction: t });
      } else {
        await team.addUser(teamCT, { transaction: t });
      }
    }
    await t.commit();
  } catch (error) {
    await t.rollback();
    return responseError(error);
  }
};

MatchService.deleteMatch = async (id) => {
  const matchFind = await match.findOne({
    where: { status: "active", id: id },
  });
  if (matchFind) {
    await team.update({ status: "deactivate" }, { where: { match_id: id } });
    return match.update({ status: "deactivate" }, { where: { id: id } });
  } else {
    return responseError("Match not exits in the system", 400);
  }
};

MatchService.editMatch = async (id, name, description) => {
  const matchFind = await match.findOne({
    where: { status: "active", id: id },
  });
  const matchDateCreate = matchFind.name.split(" ").pop();
  if (matchFind) {
    return match.update(
      { name: `${name} ${matchDateCreate}`, description: description },
      { where: { id: id } }
    );
  }
  return responseError("Match not exits in the system", 400);
};

MatchService.setTeamWin = async (id, teamWin) => {
  const st = await db.sequelize.transaction();
  try {
    let teamLost = teamWin === "T" ? "CT" : "T";
    const matchFind = await match.findOne({
      where: { status: "active", id: id },
    });
    if (matchFind) {
      await match.update(
        { state: "FINISHED" },
        {
          where: { id: id },
          transaction: st,
        }
      );
      await team.update(
        {
          result: "WIN",
        },
        {
          where: { match_id: id, team_type: teamWin },
          transaction: st,
        }
      );
      await team.update(
        {
          result: "LOSE",
        },
        {
          where: { match_id: id, team_type: teamLost },
          transaction: st,
        }
      );
      st.commit();
      return true;
    } else {
      st.rollback();
      return responseError("Match not exits in the system", 400);
    }
  } catch (error) {
    await st.rollback();
    return responseError(error);
  }
};

module.exports = MatchService;
