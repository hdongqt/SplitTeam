import * as MatchStyle from "./Match.style";
import { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { changeTextSearchMatch, deleteMatch, getMatchs } from "../../actions/matchAction";
import { setFormEditMatch } from "../../actions/formMatchAction";
import dayjs from "dayjs";
import Table from "../../components/common/Table/Table";
import * as message from "../../utils/message";
import MathEdit from "../../components/Form/MatchEdit/MatchEdit";

const Match = () => {
  let navigate = useNavigate();
  const dispatch = useDispatch();
  const refSearch = useRef(null);
  const { listMatch, fullTextSearch } = useSelector((state) => state.matchReducer);
  const { formData } = useSelector((state) => state.matchFormReducer.formEditMatch);

  useEffect(() => {
    // Debounce search
    if (refSearch && refSearch.current) {
      clearTimeout(refSearch.current);
    }
    refSearch.current = setTimeout(() => {
      dispatch(getMatchs(fullTextSearch, ""));
    }, 100);
  }, [dispatch, fullTextSearch]);

  const columns = [
    {
      name: "name",
      title: "Name",
    },
    {
      name: "state",
      title: "State",
    },
    {
      name: "",
      title: "Created",
      render: (data) => {
        return <span>{dayjs(data.createdAt).format("HH:mm DD/MM/YYYY")}</span>;
      },
    },
    {
      name: "",
      title: "Team Win",
      render: (data) => {
        const teamWin = data.teams.length > 0 && data.teams.find((item) => item.result === "WIN");
        return (
          <span>
            {data.state === "INPROGRESS" ? "Pending" : teamWin?.team_type === "CT" ? "Counter-Terrorist" : "Terrorist"}
          </span>
        );
      },
    },
    {
      name: "",
      title: "Action",
      actions: [
        {
          icon: () => "las la-edit",
          color: "#fff",
          bgColor: "#40A9FF",
          onClick: (item) => handelSetFormMatchEdit(item),
        },
        {
          icon: () => "las la-trash-alt",
          bgColor: "#EC3737",
          color: "#fff",
          onClick: (item) => handleDelete(item),
        },
        {
          icon: () => "las la-arrow-right",
          onClick: (item) => navigate(`/matchs/${item.id}`),
        },
      ],
    },
  ];

  const handleDelete = (item) => {
    message.deleteConfirm().then((result) => {
      if (result.isConfirmed) {
        dispatch(deleteMatch(item.id));
      }
    });
  };

  const handleChangeKeySearch = (value) => {
    dispatch(changeTextSearchMatch(value));
  };

  const handelSetFormMatchEdit = ({ id, name, description }) => {
    dispatch(setFormEditMatch({ id, name, description }));
  };

  return (
    <MatchStyle.Match>
      <h2>Matchs</h2>
      <MatchStyle.MatchContainer>
        <MatchStyle.MatchAction>
          <MatchStyle.MatchButtonCreate to="/matchs/create">Create</MatchStyle.MatchButtonCreate>
          <MatchStyle.MatchSearch
            placeholder="Input search..."
            value={fullTextSearch}
            onChange={(e) => handleChangeKeySearch(e.target.value)}
          />
        </MatchStyle.MatchAction>
        <Table columns={columns} data={listMatch} />
      </MatchStyle.MatchContainer>
      {formData && formData.id && <MathEdit />}
    </MatchStyle.Match>
  );
};

export default Match;
