import {
  Table,
  Column,
  Model,
  ForeignKey
} from "sequelize-typescript";
import Tag from "./Tag";
import Ticket from "./Ticket";

@Table
class TicketTag extends Model<TicketTag> {
  @ForeignKey(() => Ticket)
  @Column
  ticketId: number;

  @ForeignKey(() => Tag)
  @Column
  tagId: number;
}

export default TicketTag;
