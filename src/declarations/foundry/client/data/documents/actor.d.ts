declare namespace Actor {
    interface ToggleStatusEffectOptions {
        /**
         * Force the effect to be active or inactive regardless of its current state
         */
        active?: boolean;

        /**
         * Display the toggled effect as an overlay
         * @default false
         */
        overlay?: boolean;
    }
}

declare class Actor<
    D extends foundry.abstract.DataModel = foundry.abstract.DataModel,
    I extends Item = Item,
    AE extends ActiveEffect = ActiveEffect,
> extends _ClientDocumentMixin<D>(foundry.documents.BaseActor<D>) {
    public readonly type: string;
    public readonly name: string;
    public readonly img: string;
    public readonly system: D;
    public prototypeToken: TokenDocument | null;

    /**
     * The statuses that are applied to this actor by active effects
     */
    statuses: Set<string>;

    get items(): Collection<I>;
    get effects(): Collection<AE>;
    get isToken(): boolean;
    get appliedEffects(): AE[];
    get token(): TokenDocument;

    /**
     * Return a data object which defines the data schema against which dice rolls can be evaluated.
     * By default, this is directly the Actor's system data, but systems may extend this to include additional properties.
     * If overriding or extending this method to add additional properties, care must be taken not to mutate the original
     * object.
     */
    public getRollData(): object;

    /**
     * Toggle a configured status effect for the Actor.
     * @param statusId  A status effect ID defined in CONFIG.statusEffects
     * @param options   Additional options which modify how the effect is created
     * @returns         A promise which resolves to one of the following values:
     *                  - ActiveEffect if a new effect need to be created
     *                  - true if was already an existing effect
     *                  - false if an existing effect needed to be removed
     *                  - undefined if no changes need to be made
     */
    public toggleStatusEffect(
        statusId: string,
        options?: Actor.ToggleStatusEffectOptions,
    ): Promise<ActiveEffect | boolean | undefined>;

    /**
     * Retrieve an Array of active tokens which represent this Actor in the current canvas Scene.
     * If the canvas is not currently active, or there are no linked actors, the returned Array will be empty.
     * If the Actor is a synthetic token actor, only the exact Token which it represents will be returned.
     * @param linked Limit results to Tokens which are linked to the Actor. Otherwise, return all Tokens even those which are not linked.
     * @param document Return the Document instance rather than the PlaceableObject
     * @returns An array of Token instances in the current Scene which reference this Actor.
     */
    public getActiveTokens(
        linked?: boolean,
        document?: boolean,
    ): (TokenDocument | Token)[];

    /**
     * Get all ActiveEffects that may apply to this Actor.
     * If CONFIG.ActiveEffect.legacyTransferral is true, this is equivalent to actor.effects.contents.
     * If CONFIG.ActiveEffect.legacyTransferral is false, this will also return all the transferred ActiveEffects on any
     * of the Actor's owned Items.
     * @yields {ActiveEffect}
     */
    public *allApplicableEffects(): Generator<AE, void, void>;

    /**
     * Determine default artwork based on the provided actor data.
     * @param actorData     The source actor data.
     * @returns             Candidate actor image and prototype token artwork.
     */
    public static getDefaultArtwork(actorData: object): {
        img: string;
        texture: { src: string };
    };

    /**
     * Handle how changes to a Token attribute bar are applied to the Actor.
     * This allows for game systems to override this behavior and deploy special logic.
     * @param attribute     The attribute path
     * @param value         The target attribute value
     * @param isDelta       Whether the number represents a relative change (true) or an absolute change (false)
     * @param isBar         Whether the new value is part of an attribute bar, or just a direct value
     * @returns             The updated Actor document
     */
    public async modifyTokenAttribute(
        attribute: string,
        value: number,
        isDelta: boolean,
        isBar: boolean,
    ): Promise<Actor | undefined>;

    /**
     * Create an Actor from a given source object.
     * This is necessary for migrations to reinitialize invalid actors,
     * because the game.actors collection only accepts an instance of the
     * system type, and not this class itself.
     * @param source    Initial document data which comes from a trusted source
     * @param context   Model construction context
     * @returns         An instance of the new Actor. This should be recast.
     */
    public static fromSource(source: object, context: any = {}): this;
}
