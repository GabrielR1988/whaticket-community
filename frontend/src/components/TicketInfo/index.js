import React from "react";
import { Avatar, CardHeader, Box } from "@material-ui/core";
import { i18n } from "../../translate/i18n";
import TagsInput from "../TagsInput";

const TicketInfo = ({ contact, ticket, onClick }) => {
  return (
    <Box>
      <CardHeader
        onClick={onClick}
        style={{ cursor: "pointer" }}
        titleTypographyProps={{ noWrap: true }}
        subheaderTypographyProps={{ noWrap: true }}
        avatar={<Avatar src={contact.profilePicUrl} alt="contact_image" />}
        title={`${contact.name} #${ticket.id}`}
        subheader={
          ticket.user &&
          `${i18n.t("messagesList.header.assignedTo")} ${ticket.user.name}`
        }
      />
      <Box paddingX={2} paddingBottom={1}>
        <TagsInput ticketId={ticket.id} />
      </Box>
    </Box>
  );
};

export default TicketInfo;
