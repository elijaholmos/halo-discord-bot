export class FirebaseEvent {
    constructor(bot, {
        name = null,
        description = 'No description provided',
        ref = null,
    }) {
        this.bot = bot;
        this.name = name;
        this.description = description;
        this.ref = ref;
    }

    //These should be implemented for each individual class
    onAdd(doc) { return; }
    onModify(doc) { return; }
    onRemove(doc) { return; }
}
