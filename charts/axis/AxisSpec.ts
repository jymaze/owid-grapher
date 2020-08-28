/* AxisSpec.ts
 * ================
 *
 * This represents a finalized version of the axis configuration
 * that is ready to go into rendering-- no unfilled nulls.
 */

import { ScaleType, TickFormattingOptions } from "charts/core/ChartConstants"
import { observable, computed } from "mobx"
import { defaultTo } from "charts/utils/Util"

export interface AxisSpec {
    label: string
    tickFormat: (d: number, options?: TickFormattingOptions) => string
    domain: [number, number]
    scaleType: ScaleType
    scaleTypeOptions: ScaleType[]
    hideFractionalTicks?: boolean
    hideGridlines?: boolean
}

// Represents the actual entered configuration state in the editor
export class AxisConfig {
    @observable.ref min?: number = undefined
    @observable.ref max?: number = undefined
    @observable.ref scaleType: ScaleType = ScaleType.linear
    @observable.ref canChangeScaleType?: true = undefined
    @observable label?: string = undefined
    @observable.ref removePointsOutsideDomain?: true = undefined

    // A log scale domain cannot have values <= 0, so we
    // double check here
    @computed get constrainedMin(): number | undefined {
        if (this.scaleType === ScaleType.log && (this.min || 0) <= 0)
            return undefined
        return this.min
    }

    @computed get constrainedMax(): number | undefined {
        if (this.scaleType === ScaleType.log && (this.max || 0) <= 0)
            return undefined
        return this.max
    }

    @computed get domain(): [number | undefined, number | undefined] {
        return [this.constrainedMin, this.constrainedMax]
    }

    @computed get scaleTypeOptions(): ScaleType[] {
        return this.canChangeScaleType
            ? [ScaleType.linear, ScaleType.log]
            : [this.scaleType]
    }

    // Convert axis configuration to a finalized axis spec by supplying
    // any needed information calculated from the data
    toSpec({ defaultDomain }: { defaultDomain: [number, number] }): AxisSpec {
        return {
            label: this.label || "",
            tickFormat: d => `${d}`,
            domain: [
                Math.min(defaultTo(this.domain[0], Infinity), defaultDomain[0]),
                Math.max(defaultTo(this.domain[1], -Infinity), defaultDomain[1])
            ],
            scaleType: this.scaleType,
            scaleTypeOptions: this.scaleTypeOptions
        }
    }
}
