import Tag from "../../models/Tag";
import AppError from "../../errors/AppError";
import TicketTag from "../../models/TicketTag";

interface TagData {
  name: string;
  color?: string;
}

export const CreateTagService = async ({ name, color = "#7C7C7C" }: TagData): Promise<Tag> => {
  const tag = await Tag.create({ name, color });
  return tag;
};

export const ListTagsService = async (): Promise<Tag[]> => {
  const tags = await Tag.findAll({ order: [["name", "ASC"]] });
  return tags;
};

export const UpdateTagService = async (
  id: number,
  { name, color }: TagData
): Promise<Tag> => {
  const tag = await Tag.findByPk(id);
  if (!tag) throw new AppError("ERR_TAG_NOT_FOUND", 404);

  await tag.update({ name, color });
  return tag;
};

export const DeleteTagService = async (id: number): Promise<void> => {
  const tag = await Tag.findByPk(id);
  if (!tag) throw new AppError("ERR_TAG_NOT_FOUND", 404);
  await tag.destroy();
};

export const SyncTagsService = async (
  ticketId: number,
  tagIds: number[]
): Promise<void> => {
  await TicketTag.destroy({ where: { ticketId } });

  if (tagIds && tagIds.length > 0) {
    const records = tagIds.map(tagId => ({ ticketId, tagId }));
    await TicketTag.bulkCreate(records);
  }
};
