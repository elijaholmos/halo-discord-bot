export class FirebaseEvent {
    constructor(bot, {
        name = null,
        description = 'No description provided',
        ref = null,
        create_on_init = true,
    }) {
        this.bot = bot;
        this.name = name;
        this.description = description;
        this.ref = ref;
        this.create_on_init = create_on_init;
    }

    //These should be implemented for each individual class
    onAdd(snapshot) { return; }
    onModify(snapshot) { return; }
    onRemove(snapshot) { return; }
}
