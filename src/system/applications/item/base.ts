import { ArmorTraitId, Skill, WeaponTraitId } from '@system/types/cosmere';
import { CosmereItem } from '@system/documents/item';
import { DeepPartial, AnyObject, NONE } from '@system/types/utils';
import { renderSystemTemplate, TEMPLATES } from '@src/system/utils/templates';

// Mixins
import { ComponentHandlebarsApplicationMixin } from '@system/applications/component-system';
import { TabsApplicationMixin } from '@system/applications/mixins';
import { DescriptionItemData } from '@src/system/data/item/mixins/description';

const { ItemSheetV2 } = foundry.applications.sheets;

export interface BaseItemSheetRenderContext {
    item: CosmereItem;
}

export class BaseItemSheet extends TabsApplicationMixin(
    ComponentHandlebarsApplicationMixin(ItemSheetV2),
)<AnyObject> {
    /**
     * NOTE: Unbound methods is the standard for defining actions and forms
     * within ApplicationV2
     */
    /* eslint-disable @typescript-eslint/unbound-method */
    static DEFAULT_OPTIONS = foundry.utils.mergeObject(
        foundry.utils.deepClone(super.DEFAULT_OPTIONS),
        {
            form: {
                handler: this.onFormEvent,
                submitOnChange: true,
            } as unknown,
            actions: {
                'edit-description': this.editDescription,
                save: this.onSave,
            },
        },
    );
    /* eslint-enable @typescript-eslint/unbound-method */

    static TABS = foundry.utils.mergeObject(
        foundry.utils.deepClone(super.TABS),
        {
            description: {
                label: 'COSMERE.Item.Sheet.Tabs.Description',
                icon: '<i class="fa-solid fa-feather-pointed"></i>',
            },
            effects: {
                label: 'COSMERE.Item.Sheet.Tabs.Effects',
                icon: '<i class="fa-solid fa-bolt"></i>',
            },
        },
    );

    protected updatingDescription = false;
    protected proseDescName = '';
    protected proseDescHtml = '';
    protected expanded = false;

    get isUpdatingDescription(): boolean {
        return this.updatingDescription;
    }

    get item(): CosmereItem {
        return super.document;
    }

    /* --- Form --- */

    protected static async onFormEvent(
        this: BaseItemSheet,
        event: Event,
        form: HTMLFormElement,
        formData: FormDataExtended,
    ) {
        if (event instanceof SubmitEvent) return;

        // Handle prose mirror saving via hotkey
        if ((event.target as HTMLElement).className.includes('prosemirror')) {
            await this.saveDescription();
        }

        if (!('name' in event.target!)) return;

        if (this.item.isPhysical() && 'system.price.unit' in formData.object) {
            // Get currency id
            const [currencyId, denominationId] = (
                formData.object['system.price.unit'] as string
            ).split('.');

            // Remove the unit
            formData.delete('system.price.unit');

            // Get the currency
            const currency = CONFIG.COSMERE.currencies[currencyId];

            formData.set('system.price.currency', currency ? currencyId : NONE);

            if (currency) {
                // Get the primary denomination
                const primaryDenomination = currency.denominations.primary.find(
                    (denomination) => denomination.id === denominationId,
                );

                formData.set(
                    'system.price.denomination.primary',
                    primaryDenomination?.id ?? NONE,
                );
            }
        }

        if (this.item.hasActivation()) {
            if (
                'system.activation.cost.type' in formData.object &&
                formData.object['system.activation.cost.type'] === NONE
            )
                formData.set('system.activation.cost.type', null);

            if (
                'system.activation.consume.type' in formData.object &&
                formData.object['system.activation.consume.type'] === NONE
            )
                formData.set('system.activation.consume', null);

            if (
                'system.activation.consume.resource' in formData.object &&
                formData.object['system.activation.consume.resource'] === NONE
            )
                formData.set('system.activation.consume.resource', null);

            if (
                'system.activation.skill' in formData.object &&
                formData.object['system.activation.skill'] === NONE
            )
                formData.set('system.activation.skill', null);

            if (
                'system.activation.attribute' in formData.object &&
                formData.object['system.activation.attribute'] === 'default'
            ) {
                formData.set(
                    'system.activation.attribute',
                    CONFIG.COSMERE.skills[
                        formData.object['system.activation.skill'] as Skill
                    ].attribute,
                );
            }
            if (
                'system.activation.attribute' in formData.object &&
                formData.object['system.activation.attribute'] === NONE
            )
                formData.set('system.activation.attribute', null);

            if (
                'system.activation.uses.type' in formData.object &&
                formData.object['system.activation.uses.type'] === NONE
            )
                formData.set('system.activation.uses', null);

            if (
                'system.activation.uses.recharge' in formData.object &&
                formData.object['system.activation.uses.recharge'] === NONE
            )
                formData.set('system.activation.uses.recharge', null);
        }

        if (this.item.hasDamage()) {
            if (
                'system.damage.formula' in formData.object &&
                (formData.object['system.damage.formula'] as string).trim() ===
                    ''
            )
                formData.set('system.damage.formula', null);

            if (
                'system.damage.type' in formData.object &&
                formData.object['system.damage.type'] === NONE
            )
                formData.set('system.damage.type', null);

            if (
                'system.damage.skill' in formData.object &&
                formData.object['system.damage.skill'] === NONE
            )
                formData.set('system.damage.skill', null);

            if (
                'system.damage.attribute' in formData.object &&
                formData.object['system.damage.attribute'] === NONE
            )
                formData.set('system.damage.attribute', null);
        }

        if (this.item.hasAttack()) {
            if (
                'system.attack.range.unit' in formData.object &&
                formData.object['system.attack.range.unit'] === NONE
            )
                formData.set('system.attack.range', null);
        }

        if (this.item.hasTraits()) {
            const item = this.item;
            const object = formData.object as Record<
                string,
                string | number | boolean
            >;

            const traitsData = Object.entries(object).filter(([key]) =>
                key.startsWith('system.traits'),
            );

            const defaultValueTraitsData = traitsData.filter(([key]) =>
                key.endsWith('.defaultValue'),
            ) as [string, number][];

            defaultValueTraitsData.forEach(([key, defaultValue]) => {
                if (!defaultValue) {
                    formData.set(key, 0);
                }
            });

            const expertModifyValueTraitsData = traitsData.filter(([key]) =>
                key.endsWith('.expertise.modifyValue'),
            ) as [string, boolean][];

            expertModifyValueTraitsData.forEach(([key, modifiesValue]) => {
                // Get trait id
                const traitId = key
                    .replace('system.traits.', '')
                    .replace('.expertise.modifyValue', '') as
                    | ArmorTraitId
                    | WeaponTraitId;

                // Get the trait
                const trait = item.system.traits[traitId];

                if (modifiesValue) {
                    if (!trait.expertise?.value) {
                        // Get value
                        const value = trait.defaultValue!;
                        formData.set(
                            `system.traits.${traitId}.expertise.value`,
                            value,
                        );
                        formData.set(
                            `system.traits.${traitId}.expertise.toggleActive`,
                            false,
                        );
                    } else if (
                        object[
                            `system.traits.${traitId}.expertise.toggleActive`
                        ]
                    ) {
                        // Remove value
                        formData.set(
                            `system.traits.${traitId}.expertise.value`,
                            null,
                        );
                    }
                } else {
                    formData.set(
                        `system.traits.${traitId}.expertise.value`,
                        null,
                    );
                }

                // Remove modifyValue
                formData.delete(key);
            });
        }

        if (this.item.hasModality()) {
            // Get modality enabled
            const modalityEnabled = formData.get('modalityEnabled') === 'true';

            // Set modality
            if (modalityEnabled && this.item.system.modality === null) {
                formData.set('system.modality', '<id>');
            } else if (!modalityEnabled && this.item.system.modality !== null) {
                formData.set('system.modality', null);
            }

            // Remove modality enabled
            formData.delete('modalityEnabled');
        }

        // Update the document
        void this.item.update(formData.object);
    }

    protected async _renderFrame(
        options: Partial<foundry.applications.api.ApplicationV2.RenderOptions>,
    ): Promise<HTMLElement> {
        const frame = await super._renderFrame(options);

        const corners = await renderSystemTemplate(
            TEMPLATES.GENERAL_SHEET_CORNERS,
            {},
        );

        $(frame).prepend(corners);

        const banners = await renderSystemTemplate(
            TEMPLATES.GENERAL_SHEET_BACKGROUND,
            {},
        );
        $(frame).prepend(banners);

        return frame;
    }

    /* --- Context --- */

    public async _prepareContext(
        options: DeepPartial<foundry.applications.api.ApplicationV2.RenderOptions>,
    ) {
        let enrichedDescValue = undefined;
        let enrichedShortDescValue = undefined;
        let enrichedChatDescValue = undefined;
        if (this.item.hasDescription()) {
            enrichedDescValue = await this.enrichDescription(
                this.item.system.description!.value!,
            );
            enrichedShortDescValue = await this.enrichDescription(
                this.item.system.description!.short!,
            );
            enrichedChatDescValue = await this.enrichDescription(
                this.item.system.description!.chat!,
            );
        }
        const expandDefaultSetting =
            game.settings?.get('cosmere-rpg', 'expandDescriptionByDefault') ??
            false;
        return {
            ...(await super._prepareContext(options)),
            item: this.item,
            systemFields: (
                this.item.system.schema as foundry.data.fields.SchemaField
            ).fields,
            editable: this.isEditable,
            isUpdatingDescription: this.isUpdatingDescription,
            descHtml: enrichedDescValue,
            shortDescHtml: enrichedShortDescValue,
            chatDescHtml: enrichedChatDescValue,
            proseDescName: this.proseDescName,
            proseDescHtml: this.proseDescHtml,
            expandDefault: expandDefaultSetting,
        };
    }

    private async enrichDescription(desc: string) {
        if (
            desc === CONFIG.COSMERE.items.types[this.item.type].desc_placeholder
        ) {
            desc = game.i18n!.localize(desc);
        }
        return await TextEditor.enrichHTML(desc);
    }

    /* --- Actions --- */

    private static async editDescription(this: BaseItemSheet, event: Event) {
        event.stopPropagation();

        // Get description element
        const descElement = $(event.target!).closest('[description-type]');

        // Get description type
        const proseDescType = descElement.attr('description-type')!;

        const item = this.item as CosmereItem<DescriptionItemData>;

        // Gets the description to display based on the type found
        if (proseDescType === 'value') {
            this.proseDescHtml = item.system.description!.value!;
        } else if (proseDescType === 'short') {
            this.proseDescHtml = item.system.description!.short!;
        } else if (proseDescType === 'chat') {
            this.proseDescHtml = item.system.description!.chat!;
        }

        // Gets name for use in prose mirror
        this.proseDescName = 'system.description.' + proseDescType;

        // Switches to prose mirror
        this.updatingDescription = true;

        await this.render(true);
    }

    /**
     * Provide a static callback for the prose mirror save button
     */
    private static async onSave(this: BaseItemSheet) {
        await this.saveDescription();
    }

    /* --- Lifecycle --- */

    protected _onRender(context: AnyObject, options: AnyObject) {
        super._onRender(context, options);
        $(this.element)
            .find('.collapsible')
            .on('click', (event) => this.onClickCollapsible(event));
    }

    /* --- Event handlers --- */

    private onClickCollapsible(event: JQuery.ClickEvent) {
        const target = event.currentTarget as HTMLElement;
        target?.classList.toggle('expanded');
    }

    /* --- Helpers --- */

    /**
     * Helper to update the prose mirror edit state
     */
    private async saveDescription() {
        // Switches back from prose mirror
        this.updatingDescription = false;
        await this.render(true);
    }
}
